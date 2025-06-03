# Discourse Trust-Level Progress Tracker

> **Track how close you are to the next Trust Level on _any_ Discourse forum, right on the “Profile → Summary” page.**

---

## ✨ Features
- **Universal** – works on every Discourse site, even those hosted in a sub-directory (e.g. `example.com/forum`).  
- **Auto-detects thresholds** for TL 3 (Regular) based on the forum’s last-30-day activity, matching core Discourse logic.  
- **Colour-coded progress** – green when a requirement is met, red when you still have work to do.  
- **SPA-friendly** – refreshes automatically on client-side navigation thanks to the new `urlchange` event (and graceful fallback for older browsers).  
- **Zero configuration** – install once, it just works.

---

## 🚀 Installation (Tampermonkey)

1. **Install Tampermonkey**  
   - Chrome / Edge: <https://tampermonkey.net/?browser=chrome>  
   - Firefox: <https://tampermonkey.net/?browser=firefox>
2. **Open the raw script URL**  
   <https://raw.githubusercontent.com/lupohan44/Discourse-Trust-Level-Progress/main/progress.js>  
   Tampermonkey will prompt you to **“Install userscript”**.  
3. **Click _Install_**. That’s it!  
   - The script is named **“Discourse Trust-Level Progress Tracker”** and is currently at **v2025-06-03**.  
   - Future updates will be fetched automatically by Tampermonkey (default every 24 h).

> **Tip:** if Tampermonkey does not open the install dialog, create a new script, delete the template, and paste the file contents.

---

## 🛠 How it works

The script calls two public endpoints:

- `GET /about.json` – site-wide stats (needed for TL3 dynamic caps)  
- `GET /u/<username>/summary.json` – your personal stats  

It then overlays each requirement under **Stats** with “`current / target`” and colours the text:

| Colour | Meaning |
| ------ | ------- |
| 🟢 green | Requirement met |
| 🔴 red   | Still need work |

---

## 🎛 Customisation

All default thresholds are defined near the top of the script (object `TL_REQUIREMENTS`).  
If your forum uses non-standard settings, edit those numbers and re-save.

---

## 🧑‍💻 Contributing

1. Fork -> hack -> PR.  
2. Keep the codebase **framework-free** and in plain ES 2020 to maximise compatibility.  
3. Please test on at least one self-hosted Discourse in a sub-folder before submitting changes.

---

## 📜 License

[MIT](LICENSE)

---

## 🙏 Credits

Originally inspired by a Linux.do community post: <https://linux.do/t/topic/29204>.  
Ported and generalised by **@lupohan44** – see commit history for details.

---

## 📑 项目说明（简体中文）

**Discourse 信任等级进度追踪脚本** – 在任何 Discourse 站点的「个人资料 → 概览」页显示你距离下一等级还差多少。

### 安装步骤（Tampermonkey）

1. 安装 Tampermonkey 浏览器扩展  
2. 打开脚本原文件地址  
   <https://raw.githubusercontent.com/lupohan44/Discourse-Trust-Level-Progress/main/progress.js>  
   Tampermonkey 会自动弹出安装窗口  
3. 点击 **安装**，刷新你的 Discourse 个人档案页即可看到效果

> **提示:** 如果没有弹窗，可手动新建脚本并粘贴源码。

### 功能亮点
- 通用所有 Discourse 论坛，支持子目录部署
- 自动计算 TL 3 动态阈值
- 进度用红 / 绿颜色直观标识
- 兼容单页应用导航

如需自定义阈值，修改脚本顶部 `TL_REQUIREMENTS` 对象即可。

---

Enjoy and level-up faster!
