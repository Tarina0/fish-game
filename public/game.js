// 获取canvas和上下文
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')

// 设置canvas尺寸
function resizeCanvas() {
    const width = window.innerWidth
    const height = window.innerHeight
    // 设置一个合适的游戏区域大小
    const gameWidth = Math.min(width, 414) // 最大宽度414px
    const gameHeight = Math.min(height, 736) // 最大高度736px
    
    canvas.width = gameWidth
    canvas.height = gameHeight
}

// 初始化时调整canvas尺寸
resizeCanvas()
// 监听窗口大小变化
window.addEventListener('resize', resizeCanvas)

// 获取系统信息
const safeArea = {
    top: 20,
    bottom: canvas.height - 20
}
const topOffset = safeArea.top // 顶部偏移

// 图片加载函数
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
    })
}

// 游戏状态
let gameState = {
    currentMode: 'pond',
    fishValue: 0,
    fishes: [],
    currentFish: null,
    closeupTimer: 0,
    affection: 50,
    scrollPosition: 0,
    scrollSpeed: 1.5,
    currentZone: null,
    currentMark: null,
    lastMarkTime: 0,
    markInterval: 2000,
    affectionDecreaseSpeed: 5,
    affectionPenalty: 15,
    affectionBonus: 10,
    closeupDuration: 10000,
    waterWaves: [],
    waterTime: 0,
    affectionZones: {
        black: { min: 0, max: 20 },
        green: { min: 30, max: 70 },
        red: { min: 80, max: 100 }
    },
    fishTypes: [
        { name: '金鱼', imagePath: 'fish1.png', closeupPath: 'fish1_closeup.png', speed: 1.5, size: 60 },
        { name: '鲤鱼', imagePath: 'fish2.png', closeupPath: 'fish2_closeup.png', speed: 2, size: 80 },
        { name: '热带鱼', imagePath: 'fish3.png', closeupPath: 'fish3_closeup.png', speed: 2.5, size: 50 }
    ],
    isHolding: false,
    affectionRiseSpeed: 10,
    affectionFallSpeed: 5,
    showSuccessPopup: false,
    showSecondScreen: false,
    showThirdScreen: false,
    popupTimer: 0,
    popupButtonArea: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    },
    secondScreenButtonArea: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    }
}

// 加载图片资源
const images = {
    pondBg: new Image(),
    closeupBg: new Image(),
    successPopup: new Image(),
    secondScreen: new Image(),
    thirdScreen: new Image(),
    fishImages: {},
    fishCloseupImages: {}
}

// 加载所有图片
async function loadAllImages() {
    try {
        const loadImageWithRetry = async (src, retries = 3) => {
            console.log('开始加载图片:', src);
            for (let i = 0; i < retries; i++) {
                try {
                    const img = new Image();
                    const promise = new Promise((resolve, reject) => {
                        img.onload = () => {
                            console.log('图片加载成功:', src);
                            resolve(img);
                        };
                        img.onerror = (e) => {
                            console.error(`图片加载失败 (尝试 ${i + 1}/${retries}):`, src, e);
                            reject(new Error(`Failed to load image: ${src}`));
                        };
                    });
                    img.src = src;
                    return await promise;
                } catch (err) {
                    console.warn(`加载失败，重试中 (${i + 1}/${retries}):`, src, err);
                    if (i === retries - 1) throw err;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        };

        console.log('开始加载所有图片...');
        
        // 加载主要图片
        const mainImages = [
            {img: images.pondBg, src: '/images/pond_bg.jpg'},
            {img: images.closeupBg, src: '/images/fish_closeup_bg.jpg'},
            {img: images.successPopup, src: '/images/success_popup.png'},
            {img: images.secondScreen, src: '/images/second_screen.png'},
            {img: images.thirdScreen, src: '/images/third_screen.png'}
        ];

        // 并行加载主要图片
        await Promise.all(mainImages.map(async ({img, src}) => {
            try {
                img.src = src;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
                });
                console.log('主要图片加载成功:', src);
            } catch (err) {
                console.error('主要图片加载失败:', src, err);
                throw err;
            }
        }));

        console.log('主要图片加载完成，开始加载鱼类图片...');

        // 加载鱼的图片
        for (const type of gameState.fishTypes) {
            try {
                const fishImagePath = '/images/' + type.imagePath;
                const fishCloseupPath = '/images/' + type.closeupPath;
                images.fishImages[type.imagePath] = await loadImageWithRetry(fishImagePath);
                images.fishCloseupImages[type.closeupPath] = await loadImageWithRetry(fishCloseupPath);
                console.log('鱼类图片加载成功:', type.name);
            } catch (err) {
                console.error('鱼类图片加载失败:', type.name, err);
                throw err;
            }
        }

        console.log('所有图片加载完成，初始化游戏...');
        // 所有图片加载完成后初始化游戏
        initPond();
        gameLoop();
    } catch (error) {
        console.error('图片加载过程中发生错误:', error);
        // 显示用户友好的错误信息
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '10px';
        errorDiv.style.textAlign = 'center';
        errorDiv.innerHTML = `
            <h3>游戏加载失败</h3>
            <p>请检查网络连接并刷新页面重试</p>
            <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 10px; cursor: pointer;">
                重新加载
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
}

// 触摸事件处理
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault()
    const touch = event.touches[0]
    const rect = canvas.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    
    if (gameState.showThirdScreen) {
        return
    }
    
    if (gameState.showSecondScreen) {
        gameState.showSecondScreen = false
        gameState.showThirdScreen = true
        return
    }
    
    if (gameState.showSuccessPopup) {
        const buttonArea = gameState.popupButtonArea
        if (x >= buttonArea.x && 
            x <= buttonArea.x + buttonArea.width &&
            y >= buttonArea.y && 
            y <= buttonArea.y + buttonArea.height) {
            gameState.showSuccessPopup = false
            gameState.showSecondScreen = true
        }
        return
    }
    
    if (gameState.currentMode === 'pond') {
        for (const fish of gameState.fishes) {
            const dx = x - fish.x
            const dy = y - fish.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance < fish.width * 0.8) {
                enterCloseupMode(fish)
                break
            }
        }
    } else {
        gameState.isHolding = true
    }
})

canvas.addEventListener('touchend', () => {
    if (gameState.currentMode === 'closeup') {
        gameState.isHolding = false
    }
})

// 防止页面滚动
canvas.addEventListener('touchmove', (event) => {
    event.preventDefault()
})

// 鱼类
class Fish {
  constructor(type) {
    this.type = type
    // 设置圆形活动范围
    const pondRadius = Math.min(canvas.width, canvas.height) * 0.6 // 鱼塘半径
    const pondCenter = {
      x: canvas.width / 2,
      y: canvas.height / 2 + topOffset / 2
    }
    
    // 在圆形范围内随机生成初始位置
    const randomAngle = Math.random() * Math.PI * 2
    const randomRadius = Math.random() * pondRadius * 0.8 // 乘0.8让鱼不要太靠近边缘
    this.x = pondCenter.x + Math.cos(randomAngle) * randomRadius
    this.y = pondCenter.y + Math.sin(randomAngle) * randomRadius
    
    this.width = type.size
    this.height = type.size * 0.6
    this.speed = type.speed
    this.direction = Math.random() * Math.PI * 2
    this.targetDirection = this.direction
    this.targetSpeed = this.speed
    this.floatOffset = Math.random() * Math.PI * 2
    this.floatSpeed = 0.02 + Math.random() * 0.02
    this.changeDirectionTimer = 0
    this.changeSpeedTimer = 0
    this.pondCenter = pondCenter
    this.pondRadius = pondRadius
  }

  update() {
    // 更新浮动
    this.floatOffset += this.floatSpeed
    const floatY = Math.sin(this.floatOffset) * 0.5

    // 随机改变方向
    if (this.changeDirectionTimer <= 0) {
      this.targetDirection = this.direction + (Math.random() - 0.5) * Math.PI
      this.changeDirectionTimer = 1000 + Math.random() * 2000
    }
    this.direction += (this.targetDirection - this.direction) * 0.1

    // 随机改变速度
    if (this.changeSpeedTimer <= 0) {
      this.targetSpeed = this.type.speed * (0.5 + Math.random())
      this.changeSpeedTimer = 2000 + Math.random() * 3000
    }
    this.speed += (this.targetSpeed - this.speed) * 0.1

    // 计算下一个位置
    const nextX = this.x + Math.cos(this.direction) * this.speed
    const nextY = this.y + Math.sin(this.direction) * this.speed + floatY

    // 检查是否会超出圆形边界
    const distanceToCenter = Math.sqrt(
      Math.pow(nextX - this.pondCenter.x, 2) +
      Math.pow(nextY - this.pondCenter.y, 2)
    )

    if (distanceToCenter > this.pondRadius * 0.85) { // 使用0.85作为边界，让鱼提前转向
      // 计算从圆心到鱼的角度
      const angleToCenter = Math.atan2(
        this.y - this.pondCenter.y,
        this.x - this.pondCenter.x
      )
      
      // 设置新的方向，让鱼转向圆内
      this.direction = angleToCenter + Math.PI + (Math.random() - 0.5) * Math.PI * 0.5
      this.targetDirection = this.direction
    } else {
      this.x = nextX
      this.y = nextY
    }

    // 更新计时器
    this.changeDirectionTimer -= 16
    this.changeSpeedTimer -= 16
  }

  draw() {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.direction + Math.PI)
    ctx.drawImage(
      images.fishImages[this.type.imagePath],
      -this.width/2,
      -this.height/2,
      this.width,
      this.height
    )
    ctx.restore()
  }
}

// 初始化鱼塘
function initPond() {
  gameState.fishes = []
  for (let i = 0; i < 8; i++) { // 增加鱼的数量到8条
    const type = gameState.fishTypes[Math.floor(Math.random() * gameState.fishTypes.length)]
    gameState.fishes.push(new Fish(type))
  }
}

// 进入特写模式
function enterCloseupMode(fish) {
  gameState.currentMode = 'closeup'
  gameState.currentFish = fish
  gameState.closeupTimer = gameState.closeupDuration
  gameState.affection = 50 // 初始好感值
  gameState.scrollPosition = 0
  generateTargetZones()
  generateNewMark()
}

// 生成目标区域
function generateTargetZones() {
  if (gameState.currentFish) {
    const closeupImage = images.fishCloseupImages[gameState.currentFish.type.closeupPath]
    if (closeupImage.complete) {
      const scale = Math.min(
        canvas.width / closeupImage.width,
        canvas.height / closeupImage.height
      )
      const scaledWidth = closeupImage.width * scale
      const scaledHeight = closeupImage.height * scale
      const x = (canvas.width - scaledWidth) / 2
      const y = (canvas.height - scaledHeight) / 2

      // 在特写图片范围内生成黄色标记
      const zoneWidth = 40 // 黄色标记宽度
      const zoneX = x + Math.random() * (scaledWidth - zoneWidth)

      gameState.currentZone = {
        x: zoneX,
        width: zoneWidth,
        imageX: x, // 保存图片的X坐标
        scaledWidth: scaledWidth // 保存缩放后的宽度
      }
    }
  }
}

// 生成新的红色标记
function generateNewMark() {
  if (gameState.currentFish) {
    const closeupImage = images.fishCloseupImages[gameState.currentFish.type.closeupPath]
    if (closeupImage.complete) {
      const scale = Math.min(
        canvas.width / closeupImage.width,
        canvas.height / closeupImage.height
      )
      const scaledWidth = closeupImage.width * scale
      const scaledHeight = closeupImage.height * scale
      const x = (canvas.width - scaledWidth) / 2
      const y = (canvas.height - scaledHeight) / 2

      // 在特写图片范围内生成标记，并确保标记不会超出图片边界
      const markSize = 80 // 标记的尺寸
      const margin = markSize / 2 // 边距，防止标记超出图片边界
      const markX = x + margin + Math.random() * (scaledWidth - markSize)
      const markY = y + margin + Math.random() * (scaledHeight - markSize)

      gameState.currentMark = {
        x: markX,
        y: markY
      }
      gameState.lastMarkTime = Date.now()
    }
  }
}

// 检查是否在目标区域内
function isInTargetZone() {
  if (!gameState.currentZone || !gameState.currentFish) return false
  
  const closeupImage = images.fishCloseupImages[gameState.currentFish.type.closeupPath]
  if (!closeupImage.complete) return false

  const blockX = (gameState.scrollPosition % gameState.currentZone.scaledWidth)
  
  return blockX >= gameState.currentZone.x - gameState.currentZone.imageX && 
         blockX <= gameState.currentZone.x - gameState.currentZone.imageX + gameState.currentZone.width
}

// 游戏主循环
function gameLoop() {
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  if (gameState.currentMode === 'pond') {
    // 绘制鱼塘背景
    ctx.drawImage(images.pondBg, 0, 0, canvas.width, canvas.height)
    
    // 绘制水波效果
    drawWaterEffect()
    
    // 只绘制鱼的阴影
    for (const fish of gameState.fishes) {
      // 更新鱼的位置
      fish.update()
      
      // 绘制图片阴影
      ctx.save()
      ctx.translate(fish.x, fish.y + 10) // 增加偏移量让阴影更明显
      ctx.rotate(fish.direction + Math.PI)
      
      // 使用变换矩阵来创建更自然的投影效果
      ctx.transform(1, 0, 0, 1, 0, 0) // 只在垂直方向压缩，保持水平方向不变
      
      ctx.globalAlpha = 0.2 // 降低透明度使阴影更柔和
      ctx.filter = 'brightness(0%)' // 将图片变成纯黑色
      
      // 绘制鱼的图片作为阴影，稍微放大一点
      ctx.drawImage(
        images.fishImages[fish.type.imagePath],
        -fish.width/2,
        -fish.height/2,
        fish.width,
        fish.height
      )
      
      // 重置滤镜
      ctx.filter = 'none'
      ctx.restore()
    }
    
    // 绘制水面反光效果
    drawWaterHighlights()
    
    // 绘制摸鱼值（向下移动）
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.font = 'bold 32px Arial'
    const scoreText = `摸鱼值: ${gameState.fishValue}`
    ctx.strokeText(scoreText, 20, topOffset + 30)
    ctx.fillText(scoreText, 20, topOffset + 30)
  } else {
    // 特写模式
    ctx.drawImage(images.closeupBg, 0, 0, canvas.width, canvas.height)
    
    // 绘制特写鱼（保持比例）
    if (gameState.currentFish) {
      const closeupImage = images.fishCloseupImages[gameState.currentFish.type.closeupPath]
      // 等待图片加载完成
      if (closeupImage.complete) {
        const scale = Math.min(
          canvas.width / closeupImage.width,
          canvas.height / closeupImage.height
        )
        const scaledWidth = closeupImage.width * scale
        const scaledHeight = closeupImage.height * scale
        const x = (canvas.width - scaledWidth) / 2
        const y = (canvas.height - scaledHeight) / 2
        
        ctx.drawImage(
          closeupImage,
          x, y,
          scaledWidth, scaledHeight
        )
      }
    }
    
    // 绘制提示文字
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.font = 'bold 20px Arial' // 减小字体大小
    ctx.textAlign = 'center'
    const tipText1 = '抚摸鱼'
    const tipText2 = '使方块保持在绿色范围内即可过关'
    ctx.strokeText(tipText1, canvas.width / 2, topOffset + 30)
    ctx.fillText(tipText1, canvas.width / 2, topOffset + 30)
    ctx.strokeText(tipText2, canvas.width / 2, topOffset + 60)
    ctx.fillText(tipText2, canvas.width / 2, topOffset + 60)

    // 绘制时间（移到提示文字下方）
    ctx.font = 'bold 24px Arial'
    ctx.textAlign = 'right'
    const timeText = `${Math.ceil(gameState.closeupTimer/1000)}秒`
    ctx.strokeText(timeText, canvas.width - 20, topOffset + 100) // 调整位置
    ctx.fillText(timeText, canvas.width - 20, topOffset + 100)
    ctx.textAlign = 'left'
    
    // 绘制好感度条
    const barWidth = 12 // 减小宽度到12像素
    const barHeight = canvas.height * 0.4 // 保持高度为屏幕高度的40%
    const barX = 20 // 靠近屏幕左侧，留出20像素边距
    const barY = canvas.height * 0.3 // 保持从屏幕30%处开始

    // 绘制背景
    ctx.fillStyle = '#333'
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // 创建渐变
    const gradient = ctx.createLinearGradient(barX, barY + barHeight, barX, barY)
    gradient.addColorStop(0, '#333333') // 深灰色区域
    gradient.addColorStop(0.2, '#4CAF50') // 柔和的绿色
    gradient.addColorStop(0.8, '#4CAF50') // 柔和的绿色
    gradient.addColorStop(1, '#F44336') // 柔和的红色

    // 使用渐变填充
    ctx.fillStyle = gradient
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // 绘制当前好感度指示器
    const indicatorY = barY + barHeight - (gameState.affection / 100 * barHeight)
    ctx.fillStyle = '#fff'
    ctx.fillRect(barX - 3, indicatorY - 2, barWidth + 6, 4) // 调整指示器宽度
    
    // 更新好感值
    if (gameState.isHolding) {
      gameState.affection = Math.min(100, gameState.affection + gameState.affectionRiseSpeed * 0.016)
    } else {
      gameState.affection = Math.max(0, gameState.affection - gameState.affectionFallSpeed * 0.016)
    }
    
    // 更新计时器
    gameState.closeupTimer -= 16
    
    // 检查是否结束特写模式
    if (gameState.closeupTimer <= 0) {
      // 添加调试信息
      console.log('当前好感度:', gameState.affection)
      console.log('绿色区域范围:', gameState.affectionZones.green)
      
      // 检查是否在绿色区域内
      const inGreenZone = gameState.affection >= gameState.affectionZones.green.min && 
                         gameState.affection <= gameState.affectionZones.green.max
      
      console.log('是否在绿色区域:', inGreenZone)
      
      if (inGreenZone) {
        // 在绿色区域内，显示过关弹窗
        gameState.showSuccessPopup = true
        gameState.fishValue += 1 // 加1分作为奖励
        console.log('显示弹窗状态:', gameState.showSuccessPopup)
      } else {
        // 直接返回鱼塘
        gameState.currentMode = 'pond'
        gameState.currentFish = null
      }
    }
  }
  
  // 更新水波动画时间
  gameState.waterTime += 0.02
  
  // 在游戏主循环中修改弹窗绘制逻辑
  if (gameState.showSuccessPopup) {
    // 绘制半透明黑色背景，增加不透明度到0.85使弹窗更突出
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 绘制弹窗图片（调整尺寸和位置）
    if (images.successPopup.complete) {
      const popupWidth = canvas.width * 0.95 // 增加弹窗宽度为屏幕宽度的95%
      const popupHeight = popupWidth * (images.successPopup.height / images.successPopup.width)
      const x = (canvas.width - popupWidth) / 2
      const y = (canvas.height - popupHeight) / 2
      
      // 添加发光效果让图片更突出
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // 使用图像平滑
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      ctx.drawImage(
        images.successPopup,
        x, y,
        popupWidth, popupHeight
      )
      
      // 重置效果
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // 更新按钮点击区域
      const buttonWidth = popupWidth * 0.6
      const buttonHeight = popupHeight * 0.2
      gameState.popupButtonArea = {
        x: x + (popupWidth - buttonWidth) / 2,
        y: y + popupHeight * 0.65,
        width: buttonWidth,
        height: buttonHeight
      }
    }
  }
  
  // 绘制第二个界面
  if (gameState.showSecondScreen) {
    // 绘制半透明黑色背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 绘制第二个界面图片（居中显示）
    if (images.secondScreen.complete) {
      const screenWidth = canvas.width * 0.9 // 界面宽度为屏幕宽度的90%
      const screenHeight = screenWidth * (images.secondScreen.height / images.secondScreen.width) // 保持宽高比
      const x = (canvas.width - screenWidth) / 2
      const y = (canvas.height - screenHeight) / 2
      
      ctx.drawImage(
        images.secondScreen,
        x, y,
        screenWidth, screenHeight
      )

      // 更新按钮点击区域（根据实际界面调整）
      const buttonWidth = screenWidth * 0.4
      const buttonHeight = screenHeight * 0.15
      gameState.secondScreenButtonArea = {
        x: x + (screenWidth - buttonWidth) / 2,
        y: y + screenHeight * 0.7,
        width: buttonWidth,
        height: buttonHeight
      }

      // 用于调试按钮区域的可视化（可以注释掉）
      // ctx.strokeStyle = 'red'
      // ctx.strokeRect(
      //   gameState.secondScreenButtonArea.x,
      //   gameState.secondScreenButtonArea.y,
      //   gameState.secondScreenButtonArea.width,
      //   gameState.secondScreenButtonArea.height
      // )
    }
  }
  
  // 绘制第三个界面
  if (gameState.showThirdScreen) {
    // 绘制半透明黑色背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 绘制第三个界面图片（居中显示）
    if (images.thirdScreen.complete) {
      const screenWidth = canvas.width * 0.9 // 界面宽度为屏幕宽度的90%
      const screenHeight = screenWidth * (images.thirdScreen.height / images.thirdScreen.width) // 保持宽高比
      const x = (canvas.width - screenWidth) / 2
      const y = (canvas.height - screenHeight) / 2
      
      ctx.drawImage(
        images.thirdScreen,
        x, y,
        screenWidth, screenHeight
      )
    }
  }
  
  // 继续游戏循环
  requestAnimationFrame(gameLoop)
}

// 添加水波效果函数
function drawWaterEffect() {
  const centerY = canvas.height / 2 + topOffset / 2
  const amplitude = 3
  const frequency = 30
  const waves = 3
  
  ctx.save()
  ctx.globalAlpha = 0.1
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  
  for (let w = 0; w < waves; w++) {
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    
    for (let x = 0; x < canvas.width; x += 10) {
      const y = centerY + 
        Math.sin(x / frequency + gameState.waterTime + w) * amplitude +
        Math.sin(x / (frequency * 2) + gameState.waterTime * 1.5) * amplitude * 0.5
      ctx.lineTo(x, y)
    }
    
    ctx.lineTo(canvas.width, canvas.height)
    ctx.lineTo(0, canvas.height)
    ctx.closePath()
    ctx.fill()
  }
  
  ctx.restore()
}

// 添加水面反光效果
function drawWaterHighlights() {
  const centerY = canvas.height / 2 + topOffset / 2
  ctx.save()
  ctx.globalAlpha = 0.1
  
  for (let i = 0; i < 3; i++) {
    const y = centerY - 50 + i * 30
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  
  ctx.restore()
}

// 开始加载图片和初始化游戏
loadAllImages()
