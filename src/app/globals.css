@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none; /* Chrome, Safari and Opera */
  }
}

:root {
  --foreground-rgb: 255, 255, 255;
}

html,
body {
  height: 100%;
  overflow-x: hidden;
  /* 阻止 iOS Safari 拉动回弹 */
  overscroll-behavior: none;
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
    180deg,
    #e6f3fb 0%,
    #eaf3f7 18%,
    #f7f7f3 38%,
    #e9ecef 60%,
    #dbe3ea 80%,
    #d3dde6 100%
  );
  background-attachment: fixed;
}

/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.5);
}

/* 视频卡片悬停效果 */
.video-card-hover {
  transition: transform 0.3s ease;
}

.video-card-hover:hover {
  transform: scale(1.05);
}

/* 渐变遮罩 */
.gradient-overlay {
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.8) 100%
  );
}

/* 隐藏移动端（<768px）垂直滚动条 */
@media (max-width: 767px) {
  html,
  body {
    -ms-overflow-style: none; /* IE & Edge */
    scrollbar-width: none; /* Firefox */
  }

  html::-webkit-scrollbar,
  body::-webkit-scrollbar {
    display: none; /* Chrome Safari */
  }
}

/* 隐藏所有滚动条（兼容 WebKit、Firefox、IE/Edge） */
* {
  -ms-overflow-style: none; /* IE & Edge */
  scrollbar-width: none; /* Firefox */
}

*::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* 隐藏 Artplayer 顶部提示 */
.art-notice {
  display: none !important;
}

.art-poster {
  background-size: contain !important; /* 使图片完整展示 */
  background-position: center center !important; /* 居中显示 */
  background-repeat: no-repeat !important; /* 防止重复 */
  background-color: #000 !important; /* 其余区域填充为黑色 */
}

.art-video-player .art-layers {
  z-index: 100 !important;
}
