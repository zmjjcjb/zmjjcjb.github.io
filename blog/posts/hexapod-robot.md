---
title: 六足仿生机器人：从 PCB 到 18 路舵机的步态之旅
date: 2026-03-12
tags: [嵌入式, STM32, 机器人]
---

> 项目周期 2025.11 – 2026.03，我担任负责人。这是目前我做过的软硬件最复杂的一个项目，把这段时间的架构设计和踩坑记录整理成文。

## 整体架构

系统采用**主从架构**：

- **上位机**：Raspberry Pi 5，负责图像采集、视频回传、键盘指令解析
- **下位机**：STM32F103，负责 18 路舵机的 PWM 输出与动作调度
- **通信链路**：UART 串口，自定义帧协议

之所以这样划分，是因为舵机 PWM 对时序要求苛刻，交给裸机的 STM32 用定时器中断去打，比在 Linux 用户态里挤时间片靠谱得多；而树莓派专心干它擅长的——跑 OpenCV、推视频流。

```text
[PC 键盘] --WiFi--> [树莓派5] --UART帧协议--> [STM32F103] --18路PWM--> [舵机]
                        |                                          |
                     OpenCV 采集                              六足本体 18 自由度
                     Socket 视频回传 <----------- 实时画面延迟 < 200ms
```

## 自定义 UART 协议

帧格式很简单：帧头 + 指令字 + 18 个关节角度 + 校验和。

```c
// 帧结构：0xAA 0x55 | CMD | data[18] | SUM
typedef struct {
    uint8_t head[2];
    uint8_t cmd;        // 0x01=关节角, 0x02=步态切换
    int16_t joint[18];  // 0.1° 为单位，范围约 500~2500us 脉宽
    uint8_t sum;
} ctrl_frame_t;

uint8_t frame_sum(const ctrl_frame_t *f) {
    const uint8_t *p = (const uint8_t *)f;
    uint8_t s = 0;
    for (int i = 2; i < sizeof(ctrl_frame_t) - 1; i++) s += p[i];
    return s;
}
```

早期版本丢帧后会出现舵机抽搐，后来加了校验和 + 丢帧保持上一帧的策略才稳定下来。

## 多舵机同步：定时器中断是关键

18 路舵机如果用普通轮询方式输出 PWM，CPU 一忙各路脉宽就会抖，表现为腿软、动作不同步。

最终方案：**一个定时器中断按 50Hz 周期触发，在中断里刷新全部通道的比较寄存器**，保证 18 路在同一瞬间更新。

```c
// TIM3 更新中断：50Hz 周期统一刷新全部 PWM 通道
void TIM3_IRQHandler(void) {
    if (TIM_GetITStatus(TIM3, TIM_IT_Update) != RESET) {
        TIM_ClearITPendingBit(TIM3, TIM_IT_Update);
        for (int i = 0; i < 18; i++) {
            PWM_SetPulse(i, g_joint_pulse[i]);  // 同一中断内统一写入
        }
    }
}
```

这一步做完，多舵机同步延迟问题基本消失，各腿动作协调一致。

## 正弦步态规划

步态用最朴素但有效的**正弦运动模型**：每条腿的抬落相位差 180°，三组腿交替支撑，关节角按正弦曲线插值。

```python
# 腿部关节角生成（简化示意）
import math

def joint_angle(t, phase, amp=25.0, base=90.0):
    """t: 周期内时间, phase: 相位偏移, amp: 摆动幅值(度)"""
    return base + amp * math.sin(2 * math.pi * t + phase)

# 六足三组三角步态：相位差 120° 一组，同组左右差 180°
PHASES = [0, math.pi, 2*math.pi/3, 5*math.pi/3, 4*math.pi/3, math.pi/3]
```

前进、后退就是改相位方向，转向则是左右两侧幅值不对称。这套模型虽然比不上 CPG / 模型预测控制，但胜在简单可调，后续也留了升级成仿生四足的接口。

## 图像回传：Socket + 压缩

树莓派侧用 OpenCV 采集，JPEG 压缩后通过 Socket 推流。早期卡顿明显，压了分辨率、加了帧率限制后，端到端延迟稳定在 200ms 以内。

```python
import cv2, socket

cap = cv2.VideoCapture(0)
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

while True:
    ok, frame = cap.read()
    if not ok:
        continue
    frame = cv2.resize(frame, (320, 240))          # 压缩分辨率
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
    if ok:
        sock.sendto(buf.tobytes(), ("192.168.1.100", 9999))
```

## 硬件：从原理图到 PCB

主控板和舵机扩展板都是用 Altium Designer 画的：电源部分 5V/6V 双路、大电容缓冲舵机瞬间电流，布局时把 18 个舵机接口按腿部分组走线。第一版打回来才发现舵机电源地和大电流地没分开，地弹导致 STM32 偶尔复位——飞线割地才救回来。

## 收获

- 中断里干的事越少越稳，PWM 刷新这种"硬实时"活就该交给定时器
- 通信协议宁可多花一天设计校验和重传，也别在调试时跟丢帧搏斗
- 电源和地是要认真对待的一等公民，不是"顺手一连"

下一步计划：加 IMU 做姿态闭环，把开环步态升级成有反馈的自适应步态，向仿生四足演进。
