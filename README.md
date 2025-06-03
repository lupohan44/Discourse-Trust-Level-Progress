# Discourse Trust-Level Progress Tracker

> **Track how close you are to the next Trust Level on _any_ Discourse forum—either as a simple stats overlay _or_ a stylish floating widget.**

---

## ✨ Features
| Script | What it does | Best for |
| ------ | ------------ | -------- |
| **`progress.user.js`** | Adds progress numbers (e.g. `34 / 100`) and green/red colouring directly on the “Profile → Summary” page. | Minimal, page-native feel |
| **`progress-widget.user.js`** | Displays a modern floating sidebar widget with animated bar, quick-view cards and a detailed checklist (supports dark mode). | Eye-catching, see status anywhere |

Both scripts are:

- **Universal** – work on every Discourse site, even those hosted in a sub-directory (`example.com/forum`).  
- **Autonomous** – auto-detect TL 3 thresholds from each site’s 30-day activity.  
- **SPA-friendly** – update automatically on in-page navigation (`urlchange` with graceful fallback).  
- **Zero configuration** – install once, they just work.

---

## 🚀 Installation (Tampermonkey)

1. **Install Tampermonkey**  
   - Chrome / Edge: <https://tampermonkey.net/?browser=chrome>  
   - Firefox: <https://tampermonkey.net/?browser=firefox>

2. **Pick your preferred script**

| Script | Raw URL |
| ------ | ------- |
| Overlay version | <https://raw.githubusercontent.com/lupohan44/Discourse-Trust-Level-Progress/main/progress.user.js> |
| **Widget version (new!)** | <https://raw.githubusercontent.com/lupohan44/Discourse-Trust-Level-Progress/main/progress-widget.user.js> |

3. Open the raw link → Tampermonkey will prompt **“Install userscript”** → click **_Install_**.

Future updates are fetched automatically by Tampermonkey (default every 24 h).

> **Tip:** If the install dialog doesn’t appear, create a new script manually, remove the template and paste the file contents.

---

## 🛠 How it works

Both scripts call two public Discourse endpoints:

| Endpoint | Purpose |
| -------- | ------- |
| `GET /about.json` | Site-wide stats (needed for TL 3 dynamic caps) |
| `GET /u/&lt;username&gt;/summary.json` | Your personal stats |

They then compute each requirement, show **`current / target`** and colour the result.

Widget version additionally:

- Uses `/session/current.json` to detect login silently.
- Shows a floating button with animated progress bar and a checklist pop-out.

---

## 🎛 Customisation

Threshold defaults live near the top of each script (`TL_REQUIREMENTS`).  
If your forum uses custom numbers, tweak them and save.

---

## 🧑‍💻 Contributing

1. Fork → hack → PR.  
2. Keep it **framework-free** (plain ES 2020) for maximum compatibility.  
3. Test on at least one self-hosted Discourse in a sub-folder before submitting.

---

## 📜 License

[MIT](LICENSE)

---

## 🙏 Credits

- Inspired by a Linux.do community post: <https://linux.do/t/topic/29204>.  
- Original overlay script by **@lupohan44** – see commit history.  
- Floating widget UX adapted from <https://linux.do/t/topic/682907>.  
- Special thanks to everyone in the Discourse & Linux.do communities for feedback and ideas ❤️.

---

## 📑 项目说明（简体中文）

**Discourse 信任等级进度追踪脚本** – 现在有两种口味：

| 脚本 | 功能 |
| ---- | ---- |
| `progress.user.js` | 在「个人资料 → 概览」页，直接把各项指标改为 `当前/目标` 并标红/绿 |
| `progress-widget.user.js` | 新增右侧悬浮小部件，动画进度条 + 详细清单，任何页面都能查看 |

### 安装步骤（Tampermonkey）

1. 安装 Tampermonkey 浏览器扩展  
2. 打开脚本原文件地址（任选其一）  
   - 覆盖版：<https://raw.githubusercontent.com/lupohan44/Discourse-Trust-Level-Progress/main/progress.user.js>  
   - **悬浮版：<https://raw.githubusercontent.com/lupohan44/Discourse-Trust-Level-Progress/main/progress-widget.user.js>**  
   Tampermonkey 会自动弹出安装窗口  
3. 点击 **安装**，刷新页面即可看到效果

**自定义阈值** → 修改脚本顶部 `TL_REQUIREMENTS` 即可。

---

Enjoy—level up faster, and choose the UI that suits you!
