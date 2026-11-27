import { translations, homeChinese } from "./locale-messages.js?v=20261125-ui-polish-v3";
import { uiIcon } from "./ui-icon.js?v=20261125-ui-polish-v3";

const languages = new Map([
  ["en", "English"],
  ["zh-CN", "简体中文"],
  ["es", "Español"],
  ["fr", "Français"],
  ["ja", "日本語"],
]);
const storageKey = "huiforge.language";
function supportedLanguage(value) {
  const code = value?.toLowerCase();
  if (code === "zh" || code === "zh-cn") return "zh-CN";
  const base = code?.split("-")[0];
  return languages.has(base) ? base : "";
}
function preferredLanguage() {
  const specified = supportedLanguage(new URL(location.href).searchParams.get("lang"));
  if (specified) return specified;
  try {
    const saved = supportedLanguage(localStorage.getItem(storageKey));
    if (saved) return saved;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return document.documentElement.lang === "en" ? "en" : "zh-CN";
}
export let locale = preferredLanguage();

const messages = new Map(`
Huiforge · 创作工作台|Huiforge Studio
Huiforge · 个人中心|Huiforge Account
Huiforge · 会员与额度|Huiforge Plans and Credits
返回工作台|Back to Studio
查看额度|View credits
当前额度|Available credits
方案与额度|Plans and credits
支付尚未开放，以下方案仅供预览。|Plans are available to preview. Checkout is coming later.
当前身份|Account
今日可用|Available today
额度余额|Credit balance
每日赠送|Daily credits
今日 24:00 过期|Expires at midnight China time
会员额度|Plan credits
订阅周期结束后清零|Expires at the end of your plan cycle
本订阅周期有效|Valid for this plan cycle
直充额度|Purchased credits
充值后 24 个月有效|Valid for 24 months after purchase
开通会员|Membership plans
基础会员|Starter
标准会员|Standard
高频创作会员|Studio
首月|first month
学生、轻度创作|For occasional creators
适合日常创作|For everyday creators
高频个人、小工作室|For prolific creators and small teams
去水印与会员模型权限|Watermark-free output and member models
去水印与全部模型权限|Watermark-free output and all models
会员优先队列|Priority queue
更高优先级与并发|Higher priority and more concurrent jobs
最高优先级与更高并发|Highest priority and more concurrent jobs
可用模型 · 图像、音频、视频|Image, audio and video models
可用模型 · 全部|All models
会员价|Member rate
专业|Pro
Qwen 全系列|All Qwen models
Wan 全系列|All Wan models
Seed 全系列|All Seed models
Wan 图像与视频|Wan image and video
Wan 生成与编辑|Wan generation and editing
编辑/视频|Editing and video
开通基础会员|Preview Starter
开通标准会员|Preview Standard
开通高频创作会员|Preview Studio
按需购买，到账后 24 个月有效|Buy as needed. Credits last 24 months.
消耗|Usage
模型消耗说明|How credits are used
图像生成与编辑|Image generation and editing
按模型、清晰度、生成张数和参考图数量计算|Based on model, resolution, result count and references
视频与音频|Video and audio
按模型、规格和时长计算|Based on model, settings and duration
请以下方实时模型价目表和生成按钮显示的预计消耗为准；先消耗即将到期的余额。|Check the live model rates and generation estimate. Credits expiring first are used first.
全部模型价格|Model rates
正在读取实际价格…|Loading model rates…
暂时无法读取价格，请刷新重试。|Could not load rates. Refresh to try again.
支付功能即将接入，当前不会产生扣款。|Checkout is coming later. No payment was taken.
非会员|Standard rate
会员|Member rate
规格|Settings
按输出时长预估|Based on output duration
加购|Top up
你的创作账户|Your Huiforge account
账号方式|Account method
中国大陆手机号|China mobile
邮箱|Email
邮箱验证码|Email code
同步资产、额度与生成记录。|Access your assets, credits and creation history.
登录|Sign in
注册|Create an account
手机号|China mobile number
密码|Password
昵称|Display name
例如：南川|e.g. Alex
短信验证码|SMS code
获取验证码|Send code
创建账号|Create account
正在检查短信服务…|Checking SMS availability…
用户头像|Profile picture
更换头像|Change picture
免费用户|Free account
会员用户|Member
绘域用户|Huiforge creator
还没有个人简介。|No bio yet.
额度明细|Credit details
云端创作记录|Creation history
会员与充值|Plans and credits
充值与会员|Plans and credits
退出登录|Sign out
资料|Account
个人资料|Profile
用于留言署名与个人创作记录|Shown on your comments and creations
个人简介|Bio
介绍你的创作方向|Tell us what you make
保存资料|Save profile
额度|Credits
可用额度|Available credits
最近流水|Recent activity
暂无额度流水。|No credit activity yet.
记录|History
最多保留最近 200 张登录后生成的图片|Keeps up to 200 recent images made while signed in
还没有云端记录|No creations yet
登录后完成的创作会自动保存到这里。|Creations made while signed in appear here.
生成作品大图|Full-size creation
创作提示词|Prompt
继续创作|Continue in Studio
删除记录|Delete from history
正在登录…|Signing in…
手机号或密码不正确。|The phone number or password is incorrect.
登录失败，请稍后重试。|Could not sign in. Try again shortly.
暂时无法连接账户服务，请稍后重试。|Account service unavailable. Try again shortly.
已退出登录。|Signed out.
正在保存…|Saving…
已保存|Saved
保存失败，请稍后重试|Could not save. Try again shortly.
短信注册尚未启用；管理员需补齐短信服务配置。|Registration by SMS is currently unavailable.
暂时无法检查短信服务，请稍后重试。|Could not check SMS availability.
跳至提示词输入|Skip to prompt
创作工具栏|Studio toolbar
Huiforge 首页|Huiforge home
收起侧栏|Collapse sidebar
展开侧栏|Expand sidebar
搜索功能或页面|Search tools
搜索功能|Search tools
功能搜索结果|Tool search results
快速访问|Quick access
主页面|Studio
工作流幕布|Workflow canvas
工作台|Studio
工作流|Workflow
已固定的功能|Pinned tools
创作能力一级分类|Tool categories
正在加载创作能力…|Loading tools…
发现|Discover
发现更多内容|Discover more
技能推荐|Templates
共绘广场|Gallery
工作流分享|Shared workflows
模型说明|Model guide
发现内容|Discover
技能分类|Template categories
全部|All
商业|Commercial
角色|Characters
设计|Design
模型系列|Model families
Qwen 系列|Qwen
Seedream 系列|Seedream
Wan 系列|Wan
商业产品图|Product photography
干净布光 · 品牌质感|Clean studio lighting
电商主视觉|E-commerce campaign
动势构图 · 商品聚焦|Dynamic product composition
美妆质感图|Beauty photography
通透柔光 · 护肤广告|Soft light for skincare
食物广告|Food photography
自然光 · 食欲氛围|Warm natural light
珠宝微距|Jewelry macro
奢华高光 · 材质细节|Specular highlights and fine detail
包装样机|Packaging mockup
品牌陈列 · 纸张肌理|Brand display and paper texture
质感人像|Editorial portrait
自然抓拍 · 胶片氛围|Candid pose, film texture
电影感人像|Cinematic portrait
情绪侧光 · 35mm胶片|Moody side lighting and 35mm grain
随手抓拍|Casual snapshot
低像素 · 朦胧噪点|Low resolution and soft grain
新中式写真|Modern Chinese portrait
东方留白 · 含蓄光影|Negative space and soft shadows
商务形象照|Business headshot
自然可信 · 专业棚拍|Natural studio portrait
多角度设定|Multi-angle views
调节机位 · 主体一致|Different camera angles, same subject
角色设定表|Character sheet
三视图 · 细节拆解|Three views and close-ups
动画角色|Animated character
电影赛璐璐 · 精致线条|Cel shading and fine linework
表情设定|Expression sheet
同一角色 · 四种情绪|Four expressions for one character
电影分镜|Film storyboard
连续镜头 · 叙事节奏|A sequence of shots
手绘注解|Hand-drawn annotations
生活摄影 · 涂鸦装饰|Doodles over everyday photography
品牌主视觉|Brand campaign
玻璃材质 · 三维设计|3D glass forms
界面概念图|Interface concept
悬浮卡片 · 产品美学|Floating interface cards
照片转插画|Photo to illustration
真实融合 · 绘本质感|Storybook illustration and paper texture
水彩海报|Watercolor poster
高级留白 · 水彩晕染|Watercolor washes and negative space
室内设计|Interior design
空间材质 · 自然天光|Natural light and material detail
建筑概念|Architectural concept
极简体块 · 环境融合|Minimal forms in a landscape
360° 全景空间|360° panorama
2:1 投影 · 无缝环视|Seamless 2:1 projection
幻想概念|Fantasy concept
史诗空间 · 超现实叙事|Large-scale surreal landscapes
画笔蒙版 · 精准修改|Targeted brush masking
重新布光|Relight photo
保留人物 · 改变光线|New lighting for the same subject
智能换装|Outfit replacement
身份锁定 · 服装替换|New clothing for the same subject
神秘画家|Guest
账户状态|Account status
AI 生图工作台|Image Studio
留言|Feedback
切换界面主题|Change theme
界面主题|Theme
查看额度与会员|View credits and plans
能力目录|Tool directory
创作模式|Creation mode
图片|Image
图像|Image
编辑|Edit
视频|Video
配音|Voice
音频|Audio
文本|Text
AI 生图|Generate image
AI 生成视频|Video generation
AI 生成音频|Voice generation
AI 生视频|Video generation
AI 配音|Voice generation
图像创作|Image
视频创作|Video
声音创作|Audio
视频工具|Video tools
专业场景|Use cases
编辑与修复|Edit and restore
高级创作|Creative tools
需要 API|API required
会员专享|Members only
图片解析|Analyze image
局部重绘|Inpaint
指令编辑|Prompt edits
交互编辑|Targeted edits
图层拆分|Split layers
无损放大|Upscale
照片修复|Restore photo
图片编辑器|Image editor
AI 扩图|Extend canvas
风格迁移|Transfer style
图片融合|Blend images
创意文字|Text effects
AI 二维码|AI QR codes
AI 写真馆|AI portraits
故事连环画|Story panels
批量配图|Batch images
电商|E-commerce
建筑与室内|Architecture
人像|Portraits
游戏与动漫|Games and animation
商品换背景|Product backgrounds
营销图海报|Marketing posters
AI 抠图|Remove background
模特换装|Change outfit
模特更换调整|Change model
商品标准视图|Product views
商品环绕机位|Product angles
线稿渲染|Render a sketch
室内风格替换|Restyle interiors
材质替换|Change material
日夜转换|Day to night
室内 360° 全景|360° interiors
建筑环绕视角|Building angles
效果图超分|Upscale renders
自然精修|Retouch photo
证件照|ID photo
人像布光|Portrait lighting
妆容调整|Adjust makeup
写真风格|Portrait style
人像多角度|Portrait angles
AI 换脸|Face swap
图片转动漫|Anime style
角色设定稿|Character concept
角色多视角|Character views
游戏场景概念|Game environments
道具设计|Prop design
角色环绕机位|Character angles
处理|Edit
首尾帧生视频|First and last frame
视频参考生视频|Video references
数字人播报|Digital presenter
AI 视频编辑|AI video edit
转深度图|Depth map
视频延展|Extend video
视频风格化|Restyle video
口型同步|Lip sync
视频角色替换|Replace character
叙事制作|Story and voice
短剧|Short drama
短剧编辑 Agent|Storyboard assistant
剧本转分镜|Script to storyboard
爆款复刻|Video recreation
分镜出图|Storyboard images
分镜成片|Assemble storyboard
声音|Voice
定制音色|Design a voice
图片配音|Narrate an image
视频配音|Dub a video
项目|Projects
工作内容|Workspace
资产库|Asset library
帮助|Help
使用与状态|Guides and status
API 状态与文档|API status and docs
教程中心|Tutorials
更新日志|Changelog
没有找到相关功能|No matching tools
加入快速访问|Pin to quick access
从快速访问移除|Remove from quick access
打开神秘画家的个人资料|Open account
账号操作|Account action
工作流能力|Workflow tools
图像生成|Image generation
图片编辑|Image editing
视频编辑|Video editing
输入|Input
输出|Output
提示词|Prompt
画面描述|Prompt
编辑指令|Edit instructions
镜头描述|Shot description
配音文本|Script
生成|Generate
生成图片|Generate image
生成视频|Generate video
生成配音|Generate voice
开始编辑|Edit image
开始重绘|Inpaint
正在处理|Working…
描述你想生成的画面…|Describe the image you want to create…
描述镜头、动作和运镜…|Describe the shot, action and camera movement…
输入需要合成的旁白、对白或广告文案。|Enter narration, dialogue or ad copy.
描述画面；上传参考图就沿着它继续创作。|Describe an image or start with a reference.
描述镜头；上传一张图就让它动起来。|Describe a shot or animate a still image.
输入文案；上传一段声音就沿用它的音色。|Enter a script or work from a voice reference.
把脑海中的画面说出来。|Describe what you want to make.
从一张图，继续向前创作。|Edit an image.
让一张静态画面开始运动。|Animate an image.
从故事想法到角色与分镜。|Turn a story idea into a storyboard.
描述主体、场景、机位、光线与质感。例如：雨后旧城区，风衣女性回头，低机位中景，霓虹倒影，35mm 胶片，无文字水印。|Describe the subject, setting, camera angle and lighting.
例如：保持商品造型和标签不变，将背景改为暖灰色摄影棚，增加柔和侧逆光。|Describe what to change and what to keep.
描述希望改变或保留的细节|Describe what to change and what to keep.
选择需要编辑的图片|Choose an image to edit
选择需要处理的图片|Choose an image
选择源视频|Choose source video
选择需要配音的图片|Choose an image to narrate
选择需要放大的图片|Choose an image to upscale
选择需要重绘的图片|Choose an image to inpaint
选择参考图|Choose image
参考图|Reference image
参考素材|Reference
首帧图片|First frame
参考音频|Reference audio
尚未选择素材|No file selected
选择模型|Choose model
正在加载模型…|Loading models…
比例|Aspect ratio
方图 1:1|Square 1:1
人像 4:5|Portrait 4:5
竖幅 3:4|Portrait 3:4
海报 2:3|Poster 2:3
短视频 9:16|Vertical 9:16
横幅 16:9|Landscape 16:9
照片 3:2|Photo 3:2
影院 21:9|Cinema 21:9
分辨率|Resolution
质量|Quality
标准|Standard
精细|Fine
极致精细|Ultra
张数|Images
时长|Duration
音色|Voice
语言|Language
自动识别|Auto
中文|Chinese
英文|English
日语|Japanese
韩语|Korean
语速|Speed
情绪|Emotion
自动理解|Auto
不使用预设|No preset
自然写实|Natural
风格|Style
取消|Cancel
关闭|Close
结果|Results
准备就绪|Ready
暂无结果|No results yet
查看已生成记录|View history
生成记录|History
清空|Clear
暂无记录|No history yet
生成图片后会显示在这里|Your images will appear here
打开工作流幕布|Open canvas
返回快速创作|Back to Studio
把复杂创意，铺在一块幕布上。|Build a reusable workflow.
添加节点|Add node
画布编辑|Canvas editing
小地图|Minimap
小地图，使用方向键平移|Minimap, use arrow keys to pan
对齐与分布|Align and distribute
对齐|Align
等距分布|Distribute evenly
左对齐|Align left
水平居中|Center horizontally
右对齐|Align right
顶端对齐|Align top
垂直居中|Center vertically
底端对齐|Align bottom
水平等距|Space horizontally
垂直等距|Space vertically
撤销|Undo
重做|Redo
复制节点|Copy nodes
粘贴节点|Paste nodes
复制副本|Duplicate selection
聚焦选中节点|Fit selection
删除选中节点|Delete selected nodes
添加节点（Shift+A）|Add node (Shift+A)
关闭节点选择器|Close node picker
节点分类|Node categories
搜索节点|Search nodes
抓手工具|Hand tool
抓手 H / 选择 V|Hand (H) / Select (V)
无界、可平移缩放的工作流画布|Workflow canvas
音频编辑|Audio editing
文字输出|Text output
新建|New
导入|Import
适配|Fit
示例|Example
保存 / 分享|Save / share
保存与分享工作流|Save and share
连线|Links
实线|Solid
虚线|Dashed
隐藏|Hide
运行|Run
缩小画布|Zoom out
放大画布|Zoom in
场景|Scenes
资产|Assets
个人资产|Assets
缩放画布|Zoom
缩小画布|Zoom out
工作流名称|Workflow name
一句话说明|Description
发现标签|Tags
保存到本机|Save draft
另存副本|Save a copy
导出 JSON|Export JSON
发布分享|Publish
社区|Community
本机|Drafts
工作流已保存到本机|Workflow saved in this browser
尚未保存|Unsaved
有未保存更改|Unsaved changes
已保存到本机|Saved in this browser
未命名工作流|Untitled workflow
调整大小|Resize
图片能力|Image tool
选择图片|Choose image
输入类型|Input type
输出类型|Output type
下载格式|Download format
保存方式|Save mode
只在本次预览|Preview only
保存到个人资产|Save to assets
正在保存到个人资产…|Saving to assets…
已保存到个人资产|Saved to assets
等待运行|Waiting to run
待运行|Ready
运行中|Running
已完成|Done
未完成|Failed
浏览器本地处理|Processed in browser
图片结果将在这里预览|Image preview
连接能力节点后运行|Connect a tool and run
点击节点设置参数|Click the node to edit settings
点击节点编辑提示词与参数|Click the node to edit its prompt and settings
资产名称|Name
资产分类|Category
资产类型|Asset type
加入资产|Add to assets
正在加入资产…|Saving to assets…
已加入资产库|Saved to assets
请选择先上传参考图片。|Upload a reference image first.
请先输入提示词。|Enter a prompt first.
生成失败，请稍后重试。|Generation failed. Try again shortly.
已取消本次生成。|Generation cancelled.
已停止|Stopped
会话记录|Session history
生成中|Generating
未确认声音授权，本次参考音频不会上传或处理。|Confirm permission to use the voice reference before continuing.
图片旁白生成失败，请更换图片或补充旁白要求后重试。|Could not narrate this image. Try another image or describe the narration.
请先上传参考图，或在补充要求中输入 @ 选择个人资产。|Upload a reference image or type @ to select an asset.
Qwen-Image-2512 每分钟最多生成 10 次，请稍后再试。|Qwen-Image-2512 allows ten generations a minute. Try again shortly.
当前请求较多，请稍后再试。|Too many requests. Try again shortly.
当前没有生成权限，请联系管理员。|Generation is unavailable for this account.
可用额度不足，请缩短内容或补充额度后再试。|Insufficient credits. Use shorter input or add credits.
文件或输入内容过大，请缩小图片或缩短描述后再试。|File or prompt too large. Try a smaller image or shorter prompt.
请上传 PNG、JPG 或 WebP 格式的图片。|Choose a PNG, JPG or WebP image.
当前参数组合暂不支持，请调整视角数量或分辨率后重试。|These settings are incompatible. Adjust the view count or resolution.
生成服务暂时繁忙，请稍后再试。|The generation service is busy. Try again shortly.
本次生成未完成，请调整描述后重新提交。|Generation did not finish. Adjust the prompt and try again.
请输入音色描述。|Describe the voice you want.
请输入需要合成的配音文本。|Enter the text to read.
请先上传需要配音的图片。|Choose the image to narrate.
请先上传 10–20 秒清晰参考音频。|Upload 10–20 seconds of clear reference audio.
请先上传至少一项参考素材。|Add at least one reference.
请依次上传首帧与尾帧两张图片。|Upload the first and last frames in order.
已有任务正在执行，请稍候|A job is already running.
工作流已完成，结果已写入输出节点|Workflow finished. Results are in the output nodes.
工作流未完成，请检查节点设置与服务状态|Workflow stopped. Check the node settings and service status.
已停止工作流|Workflow stopped.
工作流图片导出格式不可用，请更换格式后重试|Could not encode this image. Select another download format.
保存会更新当前草稿，另存副本会创建独立版本。草稿仅保存在当前浏览器，不跨设备同步。发布会移除私人素材引用，复用者需重新选择素材。|Drafts are stored in this browser. Publishing removes references to private assets.
已保存到当前浏览器。|Saved in this browser.
已另存为独立副本，后续保存将更新此副本。|Saved as a separate copy.
工作流 JSON 已导出。|Workflow JSON exported.
已发布。拥有链接的人可以打开并复用这套节点。|Published. Anyone with the link can reuse this workflow.
本机草稿暂时无法读取。|Could not load drafts from this browser.
还没有公开工作流，成为第一个分享的人吧。|No published workflows yet.
无法读取首页草稿，请重新输入或选择参考图。|Could not open the draft. Enter your prompt or select the reference again.
这张图片无法预览，请换一张 PNG、JPG 或 WebP 图片。|Could not preview the image. Choose a PNG, JPG or WebP file.
预设库未能加载；仍可以直接输入描述生成图像。|Could not load presets. You can still create from a prompt.
请先在参考图上点选目标或框选需要修改的区域。|Select the part of the reference you want to edit.
正在发送验证码…|Sending code…
验证码已发送，5 分钟内有效。|Code sent. It expires in five minutes.
手机号将通过火山引擎短信验证，验证码 5 分钟有效。|We will send a code by SMS. It expires in five minutes.
请先填写正确的 11 位手机号。|Enter a valid 11-digit China mobile number.
发送过于频繁，请稍后再试。|Please wait before requesting another code.
短信服务尚未完成配置。|SMS registration is currently unavailable.
验证码发送失败，请稍后重试。|Could not send a code. Try again shortly.
正在验证并创建账号…|Checking the code and creating your account…
这个手机号已经注册，请直接登录。|This number already has an account. Sign in instead.
验证码不正确或已经过期。|The code is invalid or has expired.
注册失败，请检查手机号、验证码和密码。|Could not create your account. Check your number, code and password.
请至少输入 3 个字符，描述一个清晰的画面。|Enter at least three characters to describe your scene.
暂未启用|Unavailable
会员模型|Members
开始创作|Create
使用模板|Use template
前往个人中心登录|Sign in to your account
短剧会话|Storyboard sessions
新对话|New chat
新建对话|New chat
暂无对话|No conversations yet
短剧对话与任务记录|Storyboard chat and jobs
允许生成|Allow generation
本条消息允许提交任务并消耗额度|Allow jobs that may use credits
刷新任务|Refresh job
界面语言|Interface language
确认操作|Confirm action
确认|Confirm
应用|Apply
保存|Save
复制|Copy
下载|Download
删除|Delete
发布|Publish
其他|Other
替换工作流|Replace workflow
放弃更改|Discard changes
当前工作流有未保存的更改。放弃更改并替换画布？|Discard unsaved changes and replace this workflow?
清空历史记录|Clear history
仅清除本浏览器中的已生成记录，不会删除服务器上的图片。|Only creation history in this browser will be cleared. Images on the server are kept.
声音授权|Voice permission
肖像授权|Likeness permission
请确认：该声音属于本人，或已获得权利人的明确授权。确认后可保存为个人音色资产。|Confirm that the voice is yours or that you have explicit permission to save it as a voice asset.
请确认：您拥有上传人物图片和视频的肖像权及使用授权。确认后继续提交。|Confirm that you have permission to use the likenesses in the uploaded images and videos.
请确认：参考音频是您本人的声音，或已获得权利人的明确授权。样本仅用于本次临时音色复刻。|Confirm that the reference voice is yours or that you have explicit permission. It is used for this session only.
请确认您拥有本次工作流所用人物图片和视频的肖像权及使用授权。|Confirm that you have permission to use the likenesses in this workflow.
请确认本次工作流使用的参考音频是您本人的声音，或已获得权利人的明确授权。|Confirm that the reference voice in this workflow is yours or that you have explicit permission to use it.
头像不能超过 2MB。|Profile pictures must be 2 MB or smaller.
调整节点大小|Resize node
工作流已导入|Workflow imported
工作流文件格式不正确|Invalid workflow file
已恢复示例工作流|Example workflow restored
空白工作流已新建，点击“添加节点”开始创作|Blank workflow created
社区工作流|Community workflow
加入我的工作流|Add to my workflows
工作流节点预览|Workflow node preview
关闭工作流详情|Close workflow details
音频结果将在这里预览|Audio preview
视频结果将在这里预览|Video preview
搜索资产|Search assets
正在读取资产…|Loading assets…
上传资产|Upload asset
新建分类|New category
新建资产分类|New asset category
分类名称|Category name
创建分类|Create category
这个分类还是空的|This category is empty
加入幕布|Add to canvas
未分类|Uncategorized
普通音频|Audio
音色参考|Voice reference
背景音乐|Background music
关闭内容面板|Close panel
关闭保存与分享|Close
关闭发布作品|Close
关闭资产选择|Close
关闭加入资产|Close
关闭新建分类|Close
关闭作品详情|Close
关闭留言|Close
已生成作品|Creation
已生成图像大图|Full-size creation
共绘广场作品大图|Full-size creation
共绘作品|Creation
使用模型|Model used
用这个灵感创作|Use as inspiration
评论|Comments
分享链接|Share link
发布者|Published by
分享者|Shared by
作品标题|Work title
发布我的作品|Publish work
发布到广场|Publish to gallery
发布广场|Publish to gallery
作品会复制为公开版本，原始私有记录保持不变。|A public copy will be created. Your private original stays in your history.
上传截图|Upload screenshot
告诉我们你的想法|Tell us what you think
留言分类|Feedback category
产品建议|Product suggestion
生成效果|Generation quality
功能问题|Feature issue
额度与会员|Credits and membership
故障反馈|Bug report
具体内容|Details
请描述你遇到的情况、期望结果，以及复现步骤。|Describe what happened, what you expected, and how to reproduce it.
提交留言|Send feedback
可选，PNG、JPG 或 WebP，最大 5MB|Optional · PNG, JPG or WebP, up to 5 MB
标签（最多 8 个）|Tags (up to 8)
资产服务暂时不可用|Asset service unavailable
头像上传失败，请使用 PNG、JPG 或 WebP 图片。|Upload failed. Choose a PNG, JPG or WebP image.
音乐|Music
设计图|Designs
商品|Products
分镜|Storyboard
加入工作流|Add to canvas
再次删除|Confirm deletion
删除中|Deleting…
重试删除|Try deleting again
删除失败，请稍后重试|Could not delete. Try again shortly.
资产已删除|Asset deleted
确认加入|Add asset
正在读取评论…|Loading comments…
作品标签|Work tags
互动数据|Engagement
跳过引导|Skip tour
上一步|Back
下一步|Next
引导进度|Tour progress
查看新手引导|Open tutorial
新手引导|Tutorial
关闭放大三维机位|Close
放大三维机位|Enlarge camera view
画笔大小|Brush size
完成精修|Done
放大精修|Refine mask
画布缩放|Canvas zoom
适应窗口|Fit to window
搜索图片|Search images
暂无图片|No images yet
上传|Upload
说明|Information
创作指南|Studio guide
`.trim().split("\n").map(line => line.split("|")));

const translatedSources = new Map();
const dynamicMessages = [
  [/^续费 ¥([\d.]+) \/ 月 · ([\d,]+) 额度$/, "Renews at CNY $1/month · $2 credits"],
  [/^¥([\d.]+)$/, "CNY $1"],
  [/^(\d[\d,]*) 额度$/, "$1 credits"],
  [/^1 项$/, "1 item"],
  [/^(\d+) 项$/, "$1 items"],
  [/^1 个节点$/, "1 node"],
  [/^(\d+) 个节点$/, "$1 nodes"],
  [/^已选 (\d+) 个$/, "$1 selected"],
  [/(^| · )(\d+) 张组图$/, "$1$2 related images"],
  [/(^| · )(\d+) 张$/, "$1$2 images"],
  [/(^| · )(\d+) 秒$/, "$1$2 sec"],
  [/^PNG、JPG、WebP · 最多 (\d+) 张$/, "PNG, JPG, WebP · Up to $1 images"],
  [/^PNG、JPG、WebP · 最大 (\d+)MB$/, "PNG, JPG, WebP · Up to $1 MB"],
];

function translate(source, english) {
  if (locale === "zh-CN") return homeChinese.get(source) || source;
  const key = english || messages.get(source) || source;
  const dictionary = translations.get(locale);
  if (dictionary?.has(key)) return dictionary.get(key);
  if (key !== source) return key;
  for (const [pattern, template] of dynamicMessages) {
    if (pattern.test(source)) return source.replace(pattern, dictionary?.get(template) || template);
  }
  return source;
}

export function t(source, english) {
  if (typeof source !== "string") return source;
  const value = translate(source, english);
  if (value !== source || english) {
    // Some controls build a translated label before it reaches the DOM.
    translatedSources.set(value, { source, english });
    if (translatedSources.size > 1200) {
      translatedSources.delete(translatedSources.keys().next().value);
    }
  }
  return value;
}

export function localeUrl(value) {
  try {
    const url = new URL(value, location.href);
    if (url.origin === location.origin && /^(\/|\/(index|studio|profile|pricing)\.html)$/.test(url.pathname)) {
      url.searchParams.set("lang", locale);
      return url.pathname + url.search + url.hash;
    }
  } catch { /* Malformed or unrelated links are left to the browser. */ }
  return value;
}

const attributes = ["aria-label", "title", "placeholder", "alt"];
const protectedText = [
  "script", "style", "textarea", "[contenteditable]", "[data-user-content]", "[data-language-picker]",
  "#sidebar-user-name", "#sidebar-user-avatar", "#profile-display-name", "#profile-bio-preview",
  "#profile-history-prompt", "#history-dialog-prompt", "#plaza-detail-prompt", "#plaza-detail-user",
  "#workflow-community-author", "#workflow-community-description", "#workflow-community-title",
  "#workflow-community-tags", "#workflow-comments-list", ".workflow-text-output", ".workflow-output-gallery",
  "#credit-ledger", "#tool-prompt", "#prompt", ".session-prompt",
].join(",");
const sources = new WeakMap();

function translationFor(node, field, value) {
  const records = sources.get(node);
  const previous = records?.[field];
  if (!value?.trim()) {
    if (records) delete records[field];
    return value;
  }
  const original = value === previous?.rendered
    ? previous
    : translatedSources.get(value.trim()) || { source:value.trim() };
  const rendered = value.replace(value.trim(), () => translate(original.source, original.english));
  if (rendered !== value || previous || messages.has(original.source) || homeChinese.has(original.source) || original.english) {
    if (records) records[field] = { ...original, rendered };
    else sources.set(node, { [field]:{ ...original, rendered } });
  }
  return rendered;
}

function localizeElement(node) {
  if (node.closest("[data-user-content], [data-language-picker]")) return;
  for (const name of attributes) {
    const value = node.getAttribute(name);
    if (value === null) continue;
    const translated = translationFor(node, name, value);
    if (translated !== value) node.setAttribute(name, translated);
  }
  const linkAttribute = node instanceof HTMLAnchorElement ? "href"
    : node.id === "launch-composer" ? "action" : "";
  if (linkAttribute) {
    const value = node.getAttribute(linkAttribute);
    if (!value || value.startsWith("#") || node.hasAttribute("download")) return;
    const translated = localeUrl(value);
    if (translated !== value) node.setAttribute(linkAttribute, translated);
  }
}

function localizeText(node) {
  if (node.parentElement?.closest(protectedText)) return;
  const value = node.nodeValue;
  const translated = translationFor(node, "text", value);
  if (translated === value) return;
  const option = node.parentElement;
  if (option instanceof HTMLOptionElement && !option.hasAttribute("value")) option.value = option.value;
  node.nodeValue = translated;
}

export function localizeUi(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    localizeText(root);
    return;
  }
  if (!(root instanceof Element)) return;
  localizeElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node instanceof Element && node.matches(
        "script, style, [data-user-content], [data-language-picker], #workflow-board[data-workflow-cull] > [data-node-id]:not([data-workflow-visible])",
      ) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) localizeText(node);
    else localizeElement(node);
  }
}

const titleSource = document.title;
const description = document.querySelector('meta[name="description"]');
const descriptionSource = description?.content;

function applyLanguage() {
  document.documentElement.lang = locale;
  document.title = t(titleSource);
  if (descriptionSource) description.content = t(descriptionSource);
  localizeUi(document.body);
}

function chooseLanguage(value) {
  if (!languages.has(value)) return;
  try { localStorage.setItem(storageKey, value); } catch { /* The URL still carries the choice. */ }
  const url = new URL(location.href);
  url.searchParams.set("lang", value);
  if (url.href !== location.href) history.replaceState(history.state, "", url);
  if (locale === value) return;
  locale = value;
  applyLanguage();
  window.dispatchEvent(new Event("huiforge:languagechange"));
}

function addLanguagePicker() {
  const trigger = document.querySelector("[data-language-toggle]");
  if (!trigger) return;
  const dialog = document.createElement("dialog");
  dialog.id = "language-dialog";
  dialog.className = "language-dialog dialog-compact";
  dialog.setAttribute("aria-labelledby", "language-dialog-title");
  dialog.setAttribute("data-language-picker", "");
  const close = document.createElement("button");
  close.className = "dialog-close";
  close.type = "button";
  close.innerHTML = uiIcon("close");
  close.addEventListener("click", () => dialog.close());
  const heading = document.createElement("h2");
  heading.id = "language-dialog-title";
  const list = document.createElement("div");
  list.className = "language-options";
  const options = new Map();
  for (const [code, name] of languages) {
    const option = document.createElement("button");
    option.className = "language-option";
    option.type = "button";
    option.lang = code;
    option.append(name);
    option.insertAdjacentHTML("beforeend", uiIcon("check"));
    option.addEventListener("click", () => {
      chooseLanguage(code);
      dialog.close();
    });
    options.set(code, option);
    list.append(option);
  }
  function updatePicker() {
    const label = t("界面语言", "Interface language");
    trigger.setAttribute("aria-label", `${label} · ${languages.get(locale)}`);
    trigger.title = label;
    heading.textContent = label;
    close.setAttribute("aria-label", t("关闭", "Close"));
    for (const [code, option] of options) option.setAttribute("aria-pressed", String(code === locale));
  }

  dialog.append(close, heading, list);
  document.body.append(dialog);
  trigger.setAttribute("aria-controls", dialog.id);
  trigger.addEventListener("click", () => {
    dialog.showModal();
    options.get(locale).focus();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && !dialog.querySelector(":hover")) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  window.addEventListener("huiforge:languagechange", updatePicker);
  updatePicker();
}

applyLanguage();
addLanguagePicker();

// Canvas cards are translated on entry. Observe the surrounding controls so a
// language change never rebuilds the canvas, upload fields or active dialogs.
const observer = new MutationObserver((records) => {
  const added = new Set();
  for (const record of records) {
    if (record.type === "attributes") localizeElement(record.target);
    else if (record.type === "characterData") localizeText(record.target);
    else record.addedNodes.forEach((node) => added.add(node));
  }
  added.forEach((node) => { if (node.isConnected) localizeUi(node); });
});
const observeOptions = {
  subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:[...attributes, "href"],
};
const observedRoots = document.querySelectorAll(
  ".launch-page, .profile-page, .pricing-page, .studio-sidebar, .studio-topbar, #quick-workspace, #studio-discovery, " +
  "#asset-workspace, #local-editor-asset-dialog, dialog, .onboarding-layer, .workflow-floating-actions, #workflow-node-picker, " +
  "#workflow-node-editor, .workflow-library-panel, .workflow-resource-drawer, #workflow-arrange-panel, #workflow-toast, " +
  "#workflow-draft-status, #workflow-selection-count, .capability-tool-workspace",
);
observedRoots.forEach((root) => observer.observe(root, observeOptions));
new MutationObserver((records) => {
  records.forEach((record) => record.addedNodes.forEach((node) => {
    if (!(node instanceof Element) || !node.matches("dialog:not([data-language-picker]), .onboarding-layer")) return;
    localizeUi(node);
    observer.observe(node, observeOptions);
  }));
}).observe(document.body, { childList:true });
