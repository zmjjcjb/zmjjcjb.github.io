---
title: 无人船多模态感知：深度图像 × 激光雷达点云融合
date: 2026-01-20
tags: [ROS, SLAM, 深度学习]
---

> 这个项目从 2025.04 做到现在，我是负责人。成果是一篇在投论文（《多模态融合的无人船感知系统》）和 iCAN AI 挑战赛全国总决赛一等奖。这里聊聊技术路线和几个关键点。

## 为什么要多模态

水域场景的感知有个讨厌的特点：

- **深度相机**：近处准，但水面反光、远距离拉胯
- **激光雷达**：远距离和几何结构稳，但对水面漂浮物（低矮、半透明）容易漏检

单传感器都有盲区，所以思路很直接：**深度图像 + MID360 激光雷达点云做融合**，取长补短。

## 点云预处理流水线

MID360 的原始点云不能直接用，先过一遍流水线：

```cpp
// 点云预处理：体素降采样 + 统计滤波 + 裁剪
pcl::VoxelGrid<pcl::PointXYZI> voxel;
voxel.setInputCloud(raw_cloud);
voxel.setLeafSize(0.05f, 0.05f, 0.05f);   // 5cm 体素
voxel.filter(*downsampled);

pcl::StatisticalOutlierRemoval<pcl::PointXYZI> sor;
sor.setInputCloud(downsampled);
sor.setMeanK(20);
sor.setStddevMulThresh(1.2);              // 去离群点
sor.filter(*clean_cloud);
```

滤波、降采样、配准整条流水线跑下来，处理效率稳定在 **30 FPS**，够实时用。

## 融合怎么做的

核心是**时间同步 + 空间对齐**两件事：

1. **时间同步**：ROS 里用 `message_filters` 的 ApproximateTime 策略，把深度图、点云、IMU 三路数据对齐到同一时间戳窗口
2. **空间对齐**：外参标定相机-雷达的旋转平移，把点云投影到图像平面，逐像素关联

融合之后的障碍物检测结果，准确率从单传感器的 ~85% 提到了 **95% 以上**，尤其是水面低矮漂浮物这种单雷达容易漏的目标。

## 深度学习部分

分割模型用的是 PyTorch 训练的水域语义分割网络，负责把"水面 / 障碍物 / 岸边"分开；检测分支输出障碍物类别和位置。推理结果再和融合后的点云聚类结果做交叉验证，进一步压误检。

```python
# 推理结果与点云聚类交叉验证（简化）
for det in yolo_results:                    # 图像侧检测框
    pts = project_lidar_to_bbox(det.box)    # 框内点云
    if cluster_size(pts) > MIN_CLUSTER:     # 点云侧确认有实体
        obstacles.publish(det)              # 才认为是真障碍物
```

## 工程踩坑

- **数据同步丢帧**：一开始用精确时间同步，实际雷达和相机频率对不齐，直接饿死。换 ApproximateTime + 限幅队列才稳
- **点云坐标混乱**：雷达装在船上会随浪摇，IMU 补偿这一步不能省，否则建出来的图是"歪"的
- **推理延迟抖动**：GPU 和 CPU 负载互相抢，最后把推理节点单独绑核才把帧率拉平

## 一点感想

论文在投的感觉很奇妙：改到第八稿的时候，真的会逐字怀疑自己的人生。感谢导师和实验室师兄们的帮助，也感谢 iCAN 大赛把这个项目推着往前走了一大步。

下一步：把分割模型蒸馏成轻量版，往船端的 Jetson 上塞。
