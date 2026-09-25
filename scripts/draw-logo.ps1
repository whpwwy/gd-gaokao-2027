# 原创小程序图标绘制脚本（GDI+，纯几何图形，无第三方素材）
# 输出：miniprogram/images/logo.png  1024x1024
Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

function New-RoundedPath($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# ---------- 1. 圆角方形背景：深蓝 -> 青绿渐变 ----------
$c1 = [System.Drawing.Color]::FromArgb(43, 108, 176)   # #2b6cb0 品牌蓝
$c2 = [System.Drawing.Color]::FromArgb(14, 138, 138)   # #0e8a8a 青绿
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, $c1, $c2, 55.0)
$bgPath = New-RoundedPath 0 0 $size $size 200
$g.FillPath($bgBrush, $bgPath)

# ---------- 2. 上升柱状图（圆头柱，白色递进透明度） ----------
$baseline = 900
$barW = 120
$centers = @(290, 512, 734)
$heights = @(150, 255, 360)
$alphas  = @(80, 120, 165)
for ($i = 0; $i -lt 3; $i++) {
  $cx = $centers[$i]
  $top = $baseline - $heights[$i]
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alphas[$i], 255, 255, 255))
  $g.FillRectangle($brush, $cx - $barW / 2, $top + $barW / 2, $barW, $baseline - $top - $barW / 2)
  $g.FillEllipse($brush, $cx - $barW / 2, $top, $barW, $barW)
  $brush.Dispose()
}

# ---------- 3. 上升折线 + 箭头 ----------
$p0 = New-Object System.Drawing.PointF(290, 750)
$p1 = New-Object System.Drawing.PointF(512, 645)
$p2 = New-Object System.Drawing.PointF(734, 540)
$tip = New-Object System.Drawing.PointF(794, 508)
$linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 255, 255), 16)
$linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawLines($linePen, @($p0, $p1, $p2, $tip))

# 箭头三角（沿末端方向动态计算）
$dx = 794 - 734; $dy = 508 - 540
$len = [Math]::Sqrt($dx * $dx + $dy * $dy)
$ux = $dx / $len; $uy = $dy / $len
$px = -$uy; $py = $ux
$bx = 794 - $ux * 52; $by = 508 - $uy * 52
$w1 = New-Object System.Drawing.PointF(($bx + $px * 24), ($by + $py * 24))
$w2 = New-Object System.Drawing.PointF(($bx - $px * 24), ($by - $py * 24))
$arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$g.FillPolygon($arrowBrush, @($tip, $w1, $w2))
$linePen.Dispose(); $arrowBrush.Dispose()

# ---------- 4. 金色学士帽 ----------
# 帽板（菱形，金色纵向渐变）
$capPts = @(
  (New-Object System.Drawing.PointF(512, 150)),
  (New-Object System.Drawing.PointF(844, 250)),
  (New-Object System.Drawing.PointF(512, 350)),
  (New-Object System.Drawing.PointF(180, 250))
)
$gold1 = [System.Drawing.Color]::FromArgb(255, 217, 111)
$gold2 = [System.Drawing.Color]::FromArgb(232, 150, 31)
$capBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle(180, 150, 664, 200)), $gold1, $gold2, 90.0)
$g.FillPolygon($capBrush, $capPts)

# 帽冠
$crownPts = @(
  (New-Object System.Drawing.PointF(438, 330)),
  (New-Object System.Drawing.PointF(586, 330)),
  (New-Object System.Drawing.PointF(558, 400)),
  (New-Object System.Drawing.PointF(466, 400))
)
$crownBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(217, 131, 26))
$g.FillPolygon($crownBrush, $crownPts)

# 中心扣 + 流苏
$tasselPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(246, 185, 59), 12)
$tasselPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$tasselPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($tasselPen, 512, 348, 512, 442)
$tasselBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(246, 185, 59))
$g.FillEllipse($tasselBrush, 492, 442, 40, 40)
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(138, 90, 16))), 500, 342, 24, 24)

$capBrush.Dispose(); $crownBrush.Dispose(); $tasselPen.Dispose(); $tasselBrush.Dispose()
$bgBrush.Dispose(); $bgPath.Dispose()

# ---------- 保存 ----------
$out = Join-Path $PSScriptRoot '..\miniprogram\images\logo.png'
$out = [System.IO.Path]::GetFullPath($out)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved: $out"
