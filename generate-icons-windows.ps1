# FaceAuth Icon Generator for Windows PowerShell
Write-Host "🎨 Generating FaceAuth Icons for Windows..." -ForegroundColor Cyan
Write-Host "=============================================="
Write-Host ""

# Load required assembly
Add-Type -AssemblyName System.Drawing

# Define directories
$publicDir = "public"
$iconsDir = "$publicDir\icons"
$screenshotsDir = "$publicDir\screenshots"

# Ensure directories exist
if (!(Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir -Force }
if (!(Test-Path $screenshotsDir)) { New-Item -ItemType Directory -Path $screenshotsDir -Force }

# Color palette
$colorStart = [System.Drawing.Color]::FromArgb(102, 126, 234)  # #667eea
$colorEnd = [System.Drawing.Color]::FromArgb(118, 75, 162)     # #764ba2
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 230)  # White with transparency
$gray = [System.Drawing.Color]::FromArgb(45, 55, 72)           # #2d3748

# Icon sizes from your manifest
$iconSizes = @(72, 96, 128, 144, 152, 192, 384, 512)

Write-Host "📱 Generating PNG icons..." -ForegroundColor Yellow
Write-Host ""

foreach ($size in $iconSizes) {
    Write-Host "  Creating icon-${size}x${size}.png" -NoNewline
    
    # Create bitmap
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'HighQuality'
    $graphics.InterpolationMode = 'HighQualityBicubic'
    
    # Create gradient background
    $gradientBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($size, $size)),
        $colorStart,
        $colorEnd
    )
    
    # Fill background with gradient
    $graphics.FillRectangle($gradientBrush, 0, 0, $size, $size)
    
    # Calculate scaled dimensions
    $faceRadius = [Math]::Round($size * 0.25)
    $faceCenterX = $size / 2
    $faceCenterY = $size / 2.5
    
    # Draw face circle
    $faceBrush = New-Object System.Drawing.SolidBrush($white)
    $graphics.FillEllipse($faceBrush, 
        $faceCenterX - $faceRadius, 
        $faceCenterY - $faceRadius, 
        $faceRadius * 2, 
        $faceRadius * 2
    )
    
    # Draw eyes
    $eyeRadius = [Math]::Max([Math]::Round($size * 0.04), 2)
    $eyeBrush = New-Object System.Drawing.SolidBrush($gray)
    
    # Left eye
    $graphics.FillEllipse($eyeBrush,
        $faceCenterX - $faceRadius * 0.6 - $eyeRadius,
        $faceCenterY - $eyeRadius * 0.5,
        $eyeRadius * 2,
        $eyeRadius * 2
    )
    
    # Right eye
    $graphics.FillEllipse($eyeBrush,
        $faceCenterX + $faceRadius * 0.6 - $eyeRadius,
        $faceCenterY - $eyeRadius * 0.5,
        $eyeRadius * 2,
        $eyeRadius * 2
    )
    
    # Draw smile
    $smileWidth = $faceRadius * 0.8
    $smileHeight = $faceRadius * 0.3
    $smileY = $faceCenterY + $faceRadius * 0.4
    
    $smilePen = New-Object System.Drawing.Pen($gray, [Math]::Max([Math]::Round($size * 0.02), 2))
    $smilePen.StartCap = 'Round'
    $smilePen.EndCap = 'Round'
    
    $graphics.DrawArc($smilePen,
        $faceCenterX - $smileWidth / 2,
        $smileY - $smileHeight / 2,
        $smileWidth,
        $smileHeight,
        0,
        180
    )
    
    # Draw scanning rings (face recognition concept)
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 255, 255, 255), 
                                            [Math]::Max([Math]::Round($size * 0.008), 1))
    
    # Inner ring
    $innerRing = $faceRadius * 1.4
    $graphics.DrawEllipse($ringPen,
        $faceCenterX - $innerRing,
        $faceCenterY - $innerRing,
        $innerRing * 2,
        $innerRing * 2
    )
    
    # Outer ring
    $outerRing = $faceRadius * 1.8
    $ringPen.Color = [System.Drawing.Color]::FromArgb(100, 255, 255, 255)
    $graphics.DrawEllipse($ringPen,
        $faceCenterX - $outerRing,
        $faceCenterY - $outerRing,
        $outerRing * 2,
        $outerRing * 2
    )
    
    # Save the icon
    $filename = "$iconsDir\icon-${size}x${size}.png"
    $bitmap.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $gradientBrush.Dispose()
    $faceBrush.Dispose()
    $eyeBrush.Dispose()
    $smilePen.Dispose()
    $ringPen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    
    Write-Host " ✓" -ForegroundColor Green
}

Write-Host ""
Write-Host "📸 Creating screenshot placeholders..." -ForegroundColor Yellow

# Create simple screenshot placeholders
$screenshots = @(
    @{Name="dashboard-mobile"; Width=1080; Height=1920; Label="Dashboard - Mobile View"},
    @{Name="attendance-mobile"; Width=1080; Height=1920; Label="Face Attendance - Mobile"},
    @{Name="enrollment-mobile"; Width=1080; Height=1920; Label="Biometric Enrollment"},
    @{Name="dashboard-desktop"; Width=1920; Height=1080; Label="Dashboard - Desktop View"},
    @{Name="attendance-desktop"; Width=1920; Height=1080; Label="Attendance Management"}
)

foreach ($shot in $screenshots) {
    Write-Host "  Creating $($shot.Name).png" -NoNewline
    
    $bitmap = New-Object System.Drawing.Bitmap($shot.Width, $shot.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Gradient background
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($shot.Width, $shot.Height)),
        $colorStart,
        $colorEnd
    )
    $graphics.FillRectangle($gradient, 0, 0, $shot.Width, $shot.Height)
    
    # Add text label
    $font = New-Object System.Drawing.Font("Arial", 32, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 255, 255, 255))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = 'Center'
    $format.LineAlignment = 'Center'
    
    $graphics.DrawString($shot.Label, $font, $brush, 
        [System.Drawing.RectangleF]::new(0, 0, $shot.Width, $shot.Height), $format)
    
    # Save screenshot
    $filename = "$screenshotsDir\$($shot.Name).png"
    $bitmap.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $font.Dispose()
    $brush.Dispose()
    $gradient.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    
    Write-Host " ✓" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Successfully generated all assets!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Icons: $iconsDir\" -ForegroundColor Cyan
Write-Host "📁 Screenshots: $screenshotsDir\" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm start" -ForegroundColor White
Write-Host "2. Open: http://localhost:3000" -ForegroundColor White
Write-Host "3. Your PWA now has proper icons!" -ForegroundColor White
Write-Host ""
Write-Host "✨ All done! Press any key to continue..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")