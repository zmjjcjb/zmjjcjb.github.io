---
title: 智能小车：从点灯到一等奖，PID 调参的血泪史
date: 2025-03-02
tags: [STM32, PID, 硬件]
---

> 项目时间 2024.10 – 2025.02，我任主要负责人，拿了校级智能车设计大赛一等奖。这是我的第一个完整硬件项目——从选元件、画 PCB 到写代码调参，一步没漏。回头看看，全是青春。

## 项目目标

一辆能**蓝牙遥控 + 红外循迹 + 超声波避障**的小车，避障响应时间要求 ≤ 0.5s。

## 硬件选型

| 模块 | 选型 | 理由 |
|---|---|---|
| 主控 | STM32F103C8T6 | 经典蓝-pill，资料多、够用 |
| 测距 | HC-SR04 超声波 | 便宜好用，注意 5V/3.3V 电平 |
| 循迹 | TCRT5000 红外 ×5 | 黑线检测，数字输出省事 |
| 遥控 | HC-05 蓝牙 | 透传 AT 模式配好就完事 |
| 电机 | TT 减速电机 + L298N | 扭矩一般但教学够用 |

PCB 是用 AD 画的，第一块自己画的板子打回来的时候，真的会有"这是我造的"的感动。

## 电路设计的第一个教训

原理图阶段把超声波模块的 5V 和 STM32 的 3.3V 直接怼在一起共地没做隔离，Echo 脚 5V 电平直接进 GPIO—— datasheet 说 C8T6 部分 IO 不容忍 5V。幸好当时串了个分压电阻的习惯，不然第一块板子就交代了。

> **教训：跨电压域的信号，先查电平容忍，再动手接线。**

## PID 调参血泪史

循迹的核心是转向控制。TCRT5000 五路红外给出黑线偏差，PID 输出转向修正量。

```c
// 位置式 PID（转向环）
float pid_update(pid_t *p, float error) {
    p->integral += error;
    // 积分限幅，防饱和
    if (p->integral >  I_MAX) p->integral =  I_MAX;
    if (p->integral < -I_MAX) p->integral = -I_MAX;
    float out = p->kp * error
              + p->ki * p->integral
              + p->kd * (error - p->prev_error);
    p->prev_error = error;
    return out;
}
```

调参顺序（先 P 后 D 再 I，血泪换来的顺序）：

1. **只开 P**：从 0.5 往上加，小车从"画龙"到"贴线振荡"
2. **加 D**：抑制振荡，D 太小弯道跟不上，D 太大直道发抖
3. **最后加 I**：只为了消一个固定的静态偏差（左轮电机慢半拍），I 给一点点就够

最终避障响应时间做到了 **0.5s 以内**，循迹在急弯也不丢线。

## 蓝牙遥控

HC-05 配成透传模式，手机 APP 发单字符指令，STM32 中断里解析：

```c
void USART1_IRQHandler(void) {
    if (USART_GetITStatus(USART1, USART_IT_RXNE) != RESET) {
        uint8_t ch = USART_ReceiveData(USART1);
        switch (ch) {
            case 'F': car_forward();  break;
            case 'B': car_backward(); break;
            case 'L': car_left();     break;
            case 'R': car_right();    break;
            case 'S': car_stop();     break;
        }
    }
}
```

团队里另一个同学负责 APP 端，联调那天手机一点、车动了，全组在实验室嗷了一嗓子。

## 复盘

现在回头看，这个小车在技术上毫无神秘可言，但它教会了我三件受用至今的事：

1. **先查 datasheet 再接线**，硬件不原谅想当然
2. **PID 不是玄学**，是"先 P 后 D 再 I"的纪律性流程
3. 团队分工要早：硬件、控制、APP 三条线并行，比串行省一半时间

也正是这个小车，让我确定自己喜欢"让东西动起来"的感觉——后面才有了无人车、无人船和六足机器人。
