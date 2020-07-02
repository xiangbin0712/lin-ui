import dataUtil from '../core/utils/data-util';

const detail = true;
const option = {
  bubbles: true,
  composed: true
};
// 模拟enum
const IMAGE_TYPE = {
  base64: 'base64',
  url: 'url'
};
Component({
  externalClasses: ['l-class'],
  relations: {
    '../image-clipper-tools/index': {
      type: 'child'
    }
  },
  /**
   * 组件的属性列表
   */
  properties: {
    // 组件显示隐藏
    show: {
      type: Boolean,
      value: false
    },
    // 组件层级
    zIndex: {
      type: Number,
      value: 99
    },
    // 图片url
    imageUrl: {
      type: String
    },
    // 生成的图片类型
    type: {
      type: String,
      options: ['url', 'base64'],
      value: 'url'
    },
    // 生成的图片质量
    quality: {
      type: Number,
      value: 1
    },
    // 裁剪框宽度
    width: {
      type: Number,
      value: 400
    },
    // 裁剪框高度
    height: {
      type: Number,
      value: 400
    },
    // 裁剪框最小宽度
    minWidth: {
      type: Number,
      value: 200
    },
    // 裁剪框最大宽度
    maxWidth: {
      type: Number,
      value: 600
    },
    // 裁剪框最小高度
    minHeight: {
      type: Number,
      value: 200
    },
    // 裁剪框最大高度
    maxHeight: {
      type: Number,
      value: 600
    },
    // 是否锁定裁剪框宽度	
    lockWidth: {
      type: Boolean,
      value: false
    },
    // 是否锁定裁剪框高度	
    lockHeight: {
      type: Boolean,
      value: false
    },
    // 是否锁定裁剪框比例	
    lockRatio: {
      type: Boolean,
      value: false
    },
    // 生成图片相对于裁剪框的比例
    scaleRatio: {
      type: Number,
      value: 1
    },
    // 图片最小缩放比
    minRatio: {
      type: Number,
      value: 0.5
    },
    // 图片最大缩放比
    maxRatio: {
      type: Number,
      value: 2
    },
    // 是否禁止缩放
    disableScale: {
      type: Number,
      value: false
    },
    // 是否禁止旋转
    disableRotate: {
      type: Number,
      value: false
    },
    // 是否限制移动范围	
    limitMove: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    SYS_INFO: {},
    CANVAS_WIDTH: 0,
    CANVAS_HEIGHT: 0,
    MOVE_THROTTLE: null, // 触摸移动节流setTimeout
    MOVE_THROTTLE_FLAG: true, // 节流标识
    TIME_CUT_CENTER: null, // 自动居中节流函数
    cutX: 0, // 裁剪框x轴起点，可用于裁剪框left区域宽度
    cutY: 0, // 裁剪框y轴起点，可用于裁剪框top区域高度
    clipWidth: 0, // 裁剪框宽度
    clipHeight: 0, // 裁剪框高度
    flagCutTouch: false, // 是否开始拖动裁剪框
    flagEndTouch: false, // 是否结束拖动裁剪框
    CUT_START: {}, // 拖动裁剪框所需数据
    cutAnimation: false, //是否开启图片和裁剪框过渡
    cutAnimationTime: null,
    imageWidth: 0, // 图片宽度
    imageHeight: 0, // 图片高度
    imageTop: 0, // 图片上边距
    imageLeft: 0, // 图片左边距
    scale: 1, // 图片缩放比
    angle: 0, // 图片旋转角度
    touchRelative: [{
      x: 0,
      y: 0
    }], // 手指或鼠标和图片中心的相对位置
    hypotenuseLength: 0, // 双指触摸时斜边长度
    ctx: null, // canvas上下文
  },
  /**
   * 组件监听器
   */
  observers: {
    // 监听图片url改变，获取图片信息
    'imageUrl': function (url) {
      if (!url) return;
      this.imageReset();
      wx.showLoading({
        title: '请稍候...',
        mask: true
      });
      wx.getImageInfo({
        src: url,
        success: res => {
          // 计算图片尺寸
          this.imgComputeSize(res.width, res.height);
          if (this.properties.limitMove) {
            // 限制移动，不留空白处理
            this.imgMarginDetectionScale();
            this.triggerEvent('linimageready', res, option);
          }
        },
        fail: () => {
          this.imgComputeSize();
          if (this.properties.limitMove) {
            this.imgMarginDetectionScale();
          }
        }
      });
    },
    'clipWidth, clipHeight': function (widthVal, heightVal) {
      let {
        minWidth,
        minHeight
      } = this.data;
      minWidth = minWidth / 2;
      minHeight = minHeight / 2;
      if (widthVal < minWidth) {
        dataUtil.setDiffData(this, {
          clipWidth: minWidth
        });
      }
      if (heightVal < minHeight) {
        dataUtil.setDiffData(this, {
          clipHeight: minHeight
        });
      }
      this.computeCutSize();
    },
    'rotateAngle': function (val) {
      dataUtil.setDiffData(this, {
        cutAnimation: true,
        angle: val
      });
    },
    'angle': function (val) {
      this.moveStop();
      const {
        limitMove
      } = this.properties;
      if (limitMove && val % 90) {
        dataUtil.setDiffData(this, {
          angle: Math.round(val / 90) * 90
        });
      }
      this.imgMarginDetectionScale();
    },
    'cutAnimation': function (val) {
      // 开启过渡260毫秒之后自动关闭
      clearTimeout(this.data.cutAnimationTime);
      if (val) {
        let cutAnimationTime = setTimeout(() => {
          dataUtil.setDiffData(this, {
            cutAnimation: false
          });
        }, 260);
        dataUtil.setDiffData(this, {
          cutAnimationTime
        });
      }
    },
    'limitMove': function (val) {
      if (val) {
        if (this.data.angle % 90) {
          dataUtil.setDiffData(this, {
            angle: Math.round(this.data.angle / 90) * 90
          });
        }
        this.imgMarginDetectionScale();
      }
    },
    'cutY, cutX': function () {
      this.cutDetectionPosition();
    }
  },
  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 设置裁剪框的一些信息
     */
    setCutInfo: function () {
      const {
        width,
        height
      } = this.properties;
      const {
        SYS_INFO
      } = this.data;
      // 本组件动态style默认单位为px，需将用户传入值/2
      const clipWidth = width / 2;
      const clipHeight = height / 2;
      const cutY = (SYS_INFO.windowHeight - clipHeight) / 2;
      const cutX = (SYS_INFO.windowWidth - clipWidth) / 2;
      const imageLeft = SYS_INFO.windowWidth / 2;
      const imageTop = SYS_INFO.windowHeight / 2;
      const ctx = wx.createCanvasContext('image-clipper', this);
      this.setData({
        clipWidth,
        clipHeight,
        cutX,
        cutY,
        CANVAS_HEIGHT: clipHeight,
        CANVAS_WIDTH: clipWidth,
        ctx,
        imageLeft,
        imageTop
      });
    },
    /**
     * 裁剪框居中
     */
    setCutCenter: function () {
      const {
        sysInfo,
        clipHeight,
        clipWidth,
        imageTop,
        imageLeft
      } = this.data;
      let sys = sysInfo || wx.getSystemInfoSync();
      let cutY = (sys.windowHeight - clipHeight) * 0.5;
      let cutX = (sys.windowWidth - clipWidth) * 0.5;
      //顺序不能变
      this.setData({
        imageTop: imageTop - this.data.cutY + cutY
      });
      this.setData({
        cutY
      });
      this.setData({
        imageLeft: imageLeft - this.data.cutX + cutX
      });
      this.setData({
        cutX
      });
    },
    /**
     * 开始拖动裁剪框
     * 需在此处查找到是否拖动的裁剪框四角
     */
    clipTouchStart: function (event) {
      let currentX = event.touches[0].clientX;
      let currentY = event.touches[0].clientY;
      const {
        cutX,
        cutY,
        clipWidth,
        clipHeight
      } = this.data;

      /*
       * (右下>>1 右上>>2 左上>>3 左下>>4)
       * left_x：  裁剪框左边线距离视口最左侧两点位置 [3,4]
       * right_x： 裁剪框右边线距离视口最右侧两点位置 [1,2]
       * top_y：   裁剪框顶部线距离视口最顶部两点位置 [2,3]
       * bottom_y：裁剪框底部线距离视口最底部两点位置 [1,4]
       */

      // 用户体验优化，增加裁剪框四角可触摸区域
      const EXPAND_SIZE = 24;

      let left_x1 = cutX - EXPAND_SIZE;
      let left_x2 = cutX + EXPAND_SIZE;

      let top_y1 = cutY - EXPAND_SIZE;
      let top_y2 = cutY + EXPAND_SIZE;

      let right_x1 = cutX + clipWidth - EXPAND_SIZE;
      let right_x2 = cutX + clipWidth + EXPAND_SIZE;

      let bottom_y1 = cutY + clipHeight - EXPAND_SIZE;
      let bottom_y2 = cutY + clipHeight + EXPAND_SIZE;

      /*
       * 四角
       * (右下>>1 右上>>2 左上>>3 左下>>4)
       */
      let corner;

      if (currentX > right_x1 && currentX < right_x2 && currentY > bottom_y1 && currentY < bottom_y2) {
        corner = 1;
      } else if (currentX > right_x1 && currentX < right_x2 && currentY > top_y1 && currentY < top_y2) {
        corner = 2;
      } else if (currentX > left_x1 && currentX < left_x2 && currentY > top_y1 && currentY < top_y2) {
        corner = 3;
      } else if (currentX > left_x1 && currentX < left_x2 && currentY > bottom_y1 && currentY < bottom_y2) {
        corner = 4;
      }

      this.moveDuring();
      const CUT_START = {
        width: clipWidth,
        height: clipHeight,
        x: currentX,
        y: currentY,
        cutY,
        cutX,
        corner
      };
      this.setData({
        flagCutTouch: true,
        flagEndTouch: true,
        CUT_START
      });
    },
    /**
     * 拖动裁剪框
     * 当拖动的裁剪框区域时处理数据
     */
    clipTouchMove: function (event) {
      const {
        flagCutTouch,
        MOVE_THROTTLE_FLAG,
      } = this.data;
      if (flagCutTouch && MOVE_THROTTLE_FLAG) {
        const {
          clipWidth,
          clipHeight,
          cutY: oldCutY,
          cutX: oldCutX,
          CUT_START
        } = this.data;
        let {
          maxWidth,
          minWidth,
          maxHeight,
          minHeight
        } = this.properties;
        maxWidth = maxWidth / 2;
        minWidth = minWidth / 2;
        minHeight = minHeight / 2;
        maxHeight = maxHeight / 2;
        const {
          lockRatio,
          lockHeight,
          lockWidth
        } = this.properties;
        if (lockRatio && (lockWidth || lockHeight)) return;
        const clientX = event.touches[0].clientX;
        const clientY = event.touches[0].clientY;

        dataUtil.setDiffData(this, {
          MOVE_THROTTLE_FLAG: false
        });
        this.moveThrottle();

        let width = clipWidth,
          height = clipHeight,
          cutY = oldCutY,
          cutX = oldCutX,
          // 获取裁剪框实际宽度/高度
          // 如果大于最大值则使用最大值
          // 如果小于最小值则使用最小值
          size_correct = () => {
            width = width <= maxWidth ? (width >= minWidth ? width : minWidth) : maxWidth;
            height = height <= maxHeight ? (height >= minHeight ? height : minHeight) : maxHeight;
          },
          size_inspect = () => {
            if ((width > maxWidth || width < minWidth || height > maxHeight || height < minHeight) && lockRatio) {
              size_correct();
              return false;
            } else {
              size_correct();
              return true;
            }
          };
        height = CUT_START.height + (CUT_START.corner > 1 && CUT_START.corner < 4 ? 1 : -1) * (CUT_START.y - clientY);
        switch (CUT_START.corner) {
        case 1:
          width = CUT_START.width - CUT_START.x + clientX;
          if (lockRatio) {
            height = width / (clipWidth / clipHeight);
          }
          if (!size_inspect()) return;
          break;
        case 2:
          width = CUT_START.width - CUT_START.x + clientX;
          if (lockRatio) {
            height = width / (clipWidth / clipHeight);
          }
          if (!size_inspect()) return;
          cutY = CUT_START.cutY - (height - CUT_START.height);
          break;
        case 3:
          width = CUT_START.width + CUT_START.x - clientX;
          if (lockRatio) {
            height = width / (clipWidth / clipHeight);
          }
          if (!size_inspect()) return;
          cutY = CUT_START.cutY - (height - CUT_START.height);
          cutX = CUT_START.cutX - (width - CUT_START.width);
          break;
        case 4:
          width = CUT_START.width + CUT_START.x - clientX;
          if (lockRatio) {
            height = width / (clipWidth / clipHeight);
          }
          if (!size_inspect()) return;
          cutX = CUT_START.cutX - (width - CUT_START.width);
          break;
        default:
          break;
        }

        if (!lockWidth && !lockHeight) {
          dataUtil.setDiffData(this, {
            clipWidth: width,
            clipHeight: height,
            cutX,
            cutY
          });
        } else if (!lockWidth) {
          dataUtil.setDiffData(this, {
            clipWidth: width,
            cutX
          });
        } else if (!lockHeight) {
          dataUtil.setDiffData(this, {
            clipHeight: height,
            cutY
          });
        }
        this.imgMarginDetectionScale();
      }
    },
    clipTouchEnd: function () {
      this.moveStop();
      this.setData({
        flagCutTouch: false
      });
    },
    /**
     * 清空之前的自动居中延迟函数
     */
    moveDuring: function () {
      clearTimeout(this.data.TIME_CUT_CENTER);
    },
    /**
     * 停止移动时需要做的操作
     * 清空之前的自动居中延迟函数并添加最新的
     */
    moveStop: function () {
      clearTimeout(this.data.TIME_CUT_CENTER);
      const TIME_CUT_CENTER = setTimeout(() => {
        //动画启动
        if (!this.data.cutAnimation) {
          dataUtil.setDiffData(this, {
            cutAnimation: true
          });
        }
        this.setCutCenter();
      }, 800);
      dataUtil.setDiffData(this, {
        TIME_CUT_CENTER
      });
    },
    /**
     * 重置延迟函数
     */
    moveThrottle: function () {
      if (this.data.SYS_INFO.platform === 'android') {
        clearTimeout(this.data.MOVE_THROTTLE);
        const MOVE_THROTTLE = setTimeout(() => {
          dataUtil.setDiffData(this, {
            MOVE_THROTTLE_FLAG: true
          });
        }, 800 / 40);
        dataUtil.setDiffData(this, {
          MOVE_THROTTLE
        });
      } else {
        dataUtil.setDiffData(this, {
          MOVE_THROTTLE_FLAG: true
        });
      }
    },
    /**
     * 图片初始化
     */
    imageReset: function () {
      const sys = this.data.SYS_INFO || wx.getSystemInfoSync();
      this.setData({
        scale: 1,
        angle: 0,
        imageTop: sys.windowHeight / 2,
        imageLeft: sys.windowWidth / 2
      });
    },
    /**
     * 图片加载完成
     */
    imageLoad: function () {
      this.imageReset();
      wx.hideLoading();
      this.triggerEvent('linimageload', detail, option);
    },
    /**
     * 计算图片尺寸
     */
    imgComputeSize: function (width, height) {
      // 默认按图片最小边 = 对应裁剪框尺寸
      let imageWidth = width,
        imageHeight = height;
      if (imageWidth && imageHeight) {
        if (imageWidth / imageHeight > (this.data.clipWidth || this.properties.width) / (this.data.clipWidth || this.properties.height)) {
          imageHeight = this.data.clipHeight || this.properties.height;
          imageWidth = (width / height) * imageHeight;
        } else {
          imageWidth = this.data.clipWidth || this.properties.width;
          imageHeight = (height / width) * imageWidth;
        }
      } else {
        let sys = this.data.SYS_INFO || wx.getSystemInfoSync();
        imageWidth = sys.windowWidth;
        imageHeight = 0;
      }

      this.setData({
        imageWidth,
        imageHeight
      });
    },
    /**
     * 图片边缘检测-缩放
     */
    imgMarginDetectionScale: function (scale) {
      if (!this.properties.limitMove) return;
      scale = scale || this.data.scale;
      let imageWidth = this.data.imageWidth;
      let imageHeight = this.data.imageHeight;
      if ((this.data.angle / 90) % 2) {
        imageWidth = this.data.imageHeight;
        imageHeight = this.data.imageWidth;
      }
      if (imageWidth * scale < this.data.clipWidth) {
        scale = this.data.clipWidth / imageWidth;
      }
      if (imageHeight * scale < this.data.clipHeight) {
        scale = Math.max(scale, this.data.clipHeight / imageHeight);
      }
      this.imgMarginDetectionPosition(scale);
    },
    /**
     * 图片边缘检测-位置
     */
    imgMarginDetectionPosition: function (scale) {
      if (!this.properties.limitMove) return;
      let left = this.data.imageLeft;
      let top = this.data.imageTop;
      scale = scale || this.data.scale;

      let imageWidth = this.data.imageWidth;
      let imageHeight = this.data.imageHeight;
      if ((this.data.angle / 90) % 2) {
        imageWidth = this.data.imageHeight;
        imageHeight = this.data.imageWidth;
      }
      const {
        cutX,
        clipWidth,
        cutY,
        clipHeight
      } = this.data;
      left = cutX + (imageWidth * scale) / 2 >= left ? left : cutX + (imageWidth * scale) / 2;
      left = cutX + clipWidth - (imageWidth * scale) / 2 <= left ? left : cutX + clipWidth - (imageWidth * scale) / 2;
      top = cutY + (imageHeight * scale) / 2 >= top ? top : cutY + (imageHeight * scale) / 2;
      top = cutY + clipHeight - (imageHeight * scale) / 2 <= top ? top : cutY + clipHeight - (imageHeight * scale) / 2;

      dataUtil.setDiffData(this, {
        imageLeft: left,
        imageTop: top,
        scale
      });
    },
    /**
     * 开始图片触摸
     */
    imageTouchStart: function (e) {
      this.setData({
        flagEndTouch: false
      });
      const {
        imageLeft,
        imageTop
      } = this.data;
      // 双指左指坐标
      const clientXForLeft = e.touches[0].clientX;
      const clientYForLeft = e.touches[0].clientY;

      let touchRelative = [];
      if (e.touches.length === 1) {
        // 单指拖动
        touchRelative[0] = {
          x: clientXForLeft - imageLeft,
          y: clientYForLeft - imageTop
        };
        this.setData({
          touchRelative
        });
      } else {
        // 双指右指坐标
        const clientXForRight = e.touches[1].clientX;
        const clientYForRight = e.touches[1].clientY;
        // 双指放大
        let width = Math.abs(clientXForLeft - clientXForRight);
        let height = Math.abs(clientYForLeft - clientYForRight);
        // 勾股定理求出斜边长度
        const hypotenuseLength = this.computePythagoreanTheorem(width, height);

        touchRelative = [{
          x: clientXForLeft - imageLeft,
          y: clientYForLeft - imageTop
        },
        {
          x: clientXForRight - imageLeft,
          y: clientYForRight - imageTop
        }
        ];
        this.setData({
          touchRelative
        });
        this.setData({
          hypotenuseLength
        });
      }

    },
    /**
     * 图片放大旋转等操作
     */
    imageTouchMove: function (e) {
      const {
        flagEndTouch,
        MOVE_THROTTLE_FLAG
      } = this.data;
      if (flagEndTouch || !MOVE_THROTTLE_FLAG) return;
      // 双指左指坐标
      const clientXForLeft = e.touches[0].clientX;
      const clientYForLeft = e.touches[0].clientY;

      dataUtil.setDiffData(this, {
        MOVE_THROTTLE_FLAG: false
      });
      this.moveThrottle();
      this.moveDuring();
      if (e.touches.length === 1) {
        //单指拖动
        let left = clientXForLeft - this.data.touchRelative[0].x,
          top = clientYForLeft - this.data.touchRelative[0].y;
        dataUtil.setDiffData(this, {
          imageLeft: left,
          imageTop: top
        });
        // 图像边缘检测,防止截取到空白
        this.imgMarginDetectionPosition();
      } else {
        // 双指右指坐标
        const clientXForRight = e.touches[1].clientX;
        const clientYForRight = e.touches[1].clientY;

        // 双指放大
        let width = Math.abs(clientXForLeft - clientXForRight),
          height = Math.abs(clientYForLeft - clientYForRight),
          // 勾股定理求出斜边长度
          hypotenuse = this.computePythagoreanTheorem(width, height), // 斜边
          scale = this.data.scale * (hypotenuse / this.data.hypotenuseLength),
          current_deg = 0;
        // 计算出真实缩放倍率
        // 如果禁止缩放则倍率一直为1
        if (this.properties.disableScale) {
          scale = 1;
        } else {
          scale = scale <= this.properties.minRatio ? this.properties.minRatio : scale;
          scale = scale >= this.properties.maxRatio ? this.properties.maxRatio : scale;
          this.triggerEvent('linsizechange', {
            imageWidth: this.data.imageWidth * scale,
            imageHeight: this.data.imageHeight * scale
          }, option);
        }

        this.imgMarginDetectionScale(scale);
        // 双指旋转(如果没禁用旋转)
        let touchRelative = [{
          x: clientXForLeft - this.data.imageLeft,
          y: clientYForLeft - this.data.imageTop
        },
        {
          x: clientXForRight - this.data.imageLeft,
          y: clientYForRight - this.data.imageTop
        }
        ];
        if (!this.properties.disableRotate) {
          let first_atan = (180 / Math.PI) * Math.atan2(touchRelative[0].y, touchRelative[0].x);
          let first_atan_old = (180 / Math.PI) * Math.atan2(this.data.touchRelative[0].y, this.data.touchRelative[0].x);
          let second_atan = (180 / Math.PI) * Math.atan2(touchRelative[1].y, touchRelative[1].x);
          let second_atan_old = (180 / Math.PI) * Math.atan2(this.data.touchRelative[1].y, this.data.touchRelative[1].x);
          // 当前旋转的角度
          let first_deg = first_atan - first_atan_old,
            second_deg = second_atan - second_atan_old;
          if (first_deg !== 0) {
            current_deg = first_deg;
          } else if (second_deg !== 0) {
            current_deg = second_deg;
          }
          this.triggerEvent('linrotate', {
            currentDeg: current_deg
          }, option);
        }

        dataUtil.setDiffData(this, {
          touchRelative,
          hypotenuseLength: Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)),
          angle: this.data.angle + current_deg,
          scale
        });
      }
    },
    /**
     * 图片手指触摸结束
     */
    imageTouchEnd: function () {
      dataUtil.setDiffData(this, {
        flagEndTouch: true
      });
      this.moveStop();
    },

    /**
     * 检测剪裁框位置是否在允许的范围内(屏幕内)
     */
    cutDetectionPosition: function () {
      const {
        cutX,
        cutY,
        SYS_INFO,
        clipHeight,
        clipWidth
      } = this.data;
      let cutDetectionPositionTop = () => {
          //检测上边距是否在范围内
          if (cutY < 0) {
            dataUtil.setDiffData(this, {
              cutY: 0
            });
          }
          if (cutY > SYS_INFO.windowHeight - clipHeight) {
            dataUtil.setDiffData(this, {
              cutY: SYS_INFO.windowHeight - clipHeight
            });
          }
        },
        cutDetectionPositionLeft = () => {
          //检测左边距是否在范围内
          if (cutX < 0) {
            dataUtil.setDiffData(this, {
              cutX: 0
            });
          }
          if (cutX > SYS_INFO.windowWidth - clipWidth) {
            dataUtil.setDiffData(this, {
              cutX: SYS_INFO.windowWidth - clipWidth
            });
          }
        };
      //裁剪框坐标处理（如果只写一个参数则另一个默认为0，都不写默认居中）
      if (cutY === null && cutX === null) {
        let newCutY = (SYS_INFO.windowHeight - clipHeight) * 0.5;
        let newCutX = (SYS_INFO.windowWidth - clipWidth) * 0.5;
        dataUtil.setDiffData(this, {
          cutX: newCutX, // 截取的框上边距
          cutY: newCutY // 截取的框左边距
        });
      } else if (cutY !== null && cutX !== null) {
        cutDetectionPositionTop();
        cutDetectionPositionLeft();
      } else if (cutY !== null && cutX === null) {
        cutDetectionPositionTop();
        dataUtil.setDiffData(this, {
          cutX: (SYS_INFO.windowWidth - clipWidth) / 2
        });
      } else if (cutY === null && cutX !== null) {
        cutDetectionPositionLeft();
        dataUtil.setDiffData(this, {
          cutY: (SYS_INFO.windowHeight - clipHeight) / 2
        });
      }
    },
    /**
     * 改变截取框大小
     */
    computeCutSize: function () {
      const {
        clipHeight,
        clipWidth,
        SYS_INFO,
        cutX,
        cutY
      } = this.data;
      if (clipWidth > SYS_INFO.windowWidth) {
        // 设置裁剪框宽度
        dataUtil.setDiffData(this, {
          clipWidth: SYS_INFO.windowWidth
        });
      } else if (clipWidth + cutX > SYS_INFO.windowWidth) {
        dataUtil.setDiffData(this, {
          cutX: SYS_INFO.windowWidth - cutX
        });
      }
      if (clipHeight > SYS_INFO.windowHeight) {
        // 设置裁剪框高度
        dataUtil.setDiffData(this, {
          clipHeight: SYS_INFO.windowHeight
        });
      } else if (clipHeight + cutY > SYS_INFO.windowHeight) {
        dataUtil.setDiffData(this, {
          cutY: SYS_INFO.windowHeight - cutY
        });
      }
    },
    /**
     * 勾股定理求斜边
     */
    computePythagoreanTheorem: function (width, height) {
      return Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
    },
    /**
     * 获取图片数据
     */
    getImageData: function () {
      if (!this.properties.imageUrl) {
        wx.showToast({
          title: '请选择图片',
          icon: 'none'
        });
        return;
      }
      wx.showLoading({
        title: '加载中'
      });

      const {
        clipHeight,
        clipWidth,
        ctx,
        scale,
        imageLeft,
        imageTop,
        cutX,
        cutY,
        angle
      } = this.data;
      let {
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
      } = this.data;
      const {
        scaleRatio,
        imageUrl,
        quality,
        type: imageType
      } = this.properties;
      // 绘制函数
      const draw = () => {
        // 图片真实大小
        const imageWidth = this.data.imageWidth * scale * scaleRatio;
        const imageHeight = this.data.imageHeight * scale * scaleRatio;
        // canvas和图片的相对距离
        const xpos = imageLeft - cutX;
        const ypos = imageTop - cutY;
        // 旋转画布
        ctx.translate(xpos * scaleRatio, ypos * scaleRatio);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(imageUrl, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
        ctx.draw(false, () => {
          let params = {
            width: clipWidth * scaleRatio,
            height: Math.round(clipHeight * scaleRatio),
            destWidth: clipWidth * scaleRatio,
            destHeight: Math.round(clipHeight) * scaleRatio,
            fileType: 'png',
            quality
          };

          let data = {
            url: '',
            base64: '',
            width: clipWidth * scaleRatio,
            height: clipHeight * scaleRatio
          };

          if (IMAGE_TYPE.base64 === imageType) {
            wx.canvasGetImageData({
              canvasId: 'image-clipper',
              x: 0,
              y: 0,
              width: clipWidth * scaleRatio,
              height: Math.round(clipHeight * scaleRatio),
              success: res => {
                const arrayBuffer = new Uint8Array(res.data);
                const base64 = wx.arrayBufferToBase64(arrayBuffer);
                data.base64 = base64;
                wx.hideLoading();
                this.triggerEvent('linclip', data, option);
              }
            });
          } else {
            wx.canvasToTempFilePath({
              ...params,
              canvasId: 'image-clipper',
              success: res => {
                data.url = res.tempFilePath;
                data.base64 = res.tempFilePath;
                wx.hideLoading();
                this.triggerEvent('linclip', data, option);
              },
              fail(res) {
                throw res;
              }
            },
            this
            );
          }
        });
      };

      if (CANVAS_WIDTH !== clipWidth || CANVAS_HEIGHT !== clipHeight) {
        CANVAS_WIDTH = clipWidth;
        CANVAS_HEIGHT = clipHeight;
        ctx.draw();
        setTimeout(() => {
          draw();
        }, 100);
      } else {
        draw();
      }
    }
  },

  /**
   * 组件的生命周期
   */
  lifetimes: {
    ready: function () {
      const SYS_INFO = wx.getSystemInfoSync();
      this.setData({
        SYS_INFO
      });
      this.setCutInfo();
      this.setCutCenter();
      this.computeCutSize();
      this.cutDetectionPosition();
    }
  }
});
