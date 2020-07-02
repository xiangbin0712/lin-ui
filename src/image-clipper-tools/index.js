Component({

  relations: {
    '../image-clipper/index': {
      type: 'parent'
    }
  },
  externalClasses: ['l-class'],

  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示选择图片按钮
    checkImage: {
      type: Boolean,
      value: true
    },
    checkImageIcon: {
      type: String,
      value: './images/photo.png'
    },
    // 是否显示顺时针旋转按钮
    rotateAlong: {
      type: Boolean,
      value: true
    },
    rotateAlongIcon: {
      type: String,
      value: './images/rotate-along.png'
    },
    // 是否显示逆时针旋转按钮
    rotateInverse: {
      type: Boolean,
      value: true
    },
    rotateInverseIcon: {
      type: String,
      value: './images/rotate-inverse.png'
    },
    // 是否显示确定按钮
    sure: {
      type: Boolean,
      value: true
    },
    sureIcon: {
      type: String,
      value: './images/sure.png'
    },
    // 是否显示关闭按钮
    close: {
      type: Boolean,
      value: true
    },
    closeIcon: {
      type: String,
      value: './images/close.png'
    },
    // 旋转按钮每次旋转的角度
    rotateAngle: {
      type: Number,
      value: 90
    },
    // 组件层级
    zIndex: {
      type: Number,
      value: 999
    },
    // 是否显示锁定裁剪框宽度按钮
    lockWidth: {
      type: Boolean,
      value: false
    },
    // 是否显示锁定裁剪框高度按钮
    lockHeight: {
      type: Boolean,
      value: false
    },
    // 是否显示锁定裁剪框比例按钮
    lockRatio: {
      type: Boolean,
      value: false
    },
    // 是否显示禁止缩放按钮
    disableScale: {
      type: Number,
      value: false
    },
    // 是否显示禁止旋转按钮
    disableRotate: {
      type: Number,
      value: false
    },
    // 是否显示限制移动范围按钮
    limitMove: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    formColor: '#3963bc',
    lockWidthValue: false,
    lockHeightValue: false,
    lockRatioValue: false,
    disableScaleValue: false,
    disableRotateValue: false,
    limitMoveValue: false
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 获取图片信息
     */
    getImageData: async function () {
      let parent = this.getRelationNodes('../image-clipper/index')[0];
      await parent.getImageData();
    },
    /**
     * 上传图片
     */
    uploadImage: function () {
      wx.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePaths = res.tempFilePaths;
          let parent = this.getRelationNodes('../image-clipper/index')[0];
          await parent.setData({
            imageUrl: tempFilePaths
          });
        }
      });
    },
    /**
     * 旋转
     */
    rotate: async function (event) {
      let parent = this.getRelationNodes('../image-clipper/index')[0];
      if (!parent.properties.imageUrl) {
        wx.showToast({
          title: '请选择图片',
          icon: 'none'
        });
        return;
      }
      const {
        rotateAngle
      } = this.properties;
      const originAngle = parent.data.angle;
      const type = event.currentTarget.dataset.type;
      if (type === 'along') {
        await parent.setData({
          angle: originAngle + rotateAngle
        });
      } else {
        await parent.setData({
          angle: originAngle - rotateAngle
        });
      }

    },
    /**
     * 关闭
     */
    close: async function () {
      let parent = this.getRelationNodes('../image-clipper/index')[0];
      await parent.setData({
        show: false
      });
    },
    /**
     * switch change事件
     */
    bindSwitchChange: async function(event) {
      const value = event.detail.value;
      const type = event.currentTarget.dataset.type;
      let parent = this.getRelationNodes('../image-clipper/index')[0];
      await parent.setData({
        [type]: value
      });
    },
    bindSliderChange: async function() {

    }
  }
});
