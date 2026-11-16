// Test script for volume preview edge cases
// Run with: node test/test-volume-preview-edge-cases.js

// Simulate the positionVolumePreview logic
function testPositionVolumePreview() {
  const tests = [
    {
      name: 'Normal case - anchor on left, preview fits on right',
      rect: { left: 100, right: 142, top: 200, height: 63, width: 42 },
      windowWidth: 1440,
      windowHeight: 900,
      previewWidth: 360,
      previewHeight: 480,
      expectedFlip: false
    },
    {
      name: 'Right edge flip - anchor near right edge',
      rect: { left: 1200, right: 1242, top: 200, height: 63, width: 42 },
      windowWidth: 1440,
      windowHeight: 900,
      previewWidth: 360,
      previewHeight: 480,
      expectedFlip: true
    },
    {
      name: 'Right edge flip - anchor at far right',
      rect: { left: 1350, right: 1392, top: 200, height: 63, width: 42 },
      windowWidth: 1440,
      windowHeight: 900,
      previewWidth: 360,
      previewHeight: 480,
      expectedFlip: true
    },
    {
      name: 'Short window - 70vh cap test (windowHeight=400, 70vh=280)',
      rect: { left: 100, right: 142, top: 50, height: 63, width: 42 },
      windowWidth: 1440,
      windowHeight: 400,
      previewWidth: 360,
      previewHeight: 280, // 70vh cap
      expectedFlip: false
    },
    {
      name: 'Short window - anchor at bottom, preview should clamp',
      rect: { left: 100, right: 142, top: 320, height: 63, width: 42 },
      windowHeight: 400,
      windowWidth: 1440,
      previewWidth: 360,
      previewHeight: 280,
      expectedFlip: false
    },
    {
      name: 'Very tall cover - natural height > 70vh (e.g., 800px cover on 900px window)',
      rect: { left: 100, right: 142, top: 200, height: 63, width: 42 },
      windowWidth: 1440,
      windowHeight: 900,
      previewWidth: 360,
      previewHeight: 630, // 70vh = 630
      expectedFlip: false
    },
    {
      name: 'Square cover near right edge',
      rect: { left: 1100, right: 1142, top: 200, height: 63, width: 42 },
      windowWidth: 1440,
      windowHeight: 900,
      previewWidth: 360,
      previewHeight: 360, // square cover
      expectedFlip: true
    }
  ];

  const gap = 14;
  const margin = 10;

  tests.forEach(test => {
    const rect = test.rect;
    const w = test.previewWidth;
    const h = test.previewHeight;
    const windowWidth = test.windowWidth;
    const windowHeight = test.windowHeight;

    let left = rect.right + gap;
    let flipped = false;
    
    if (left + w > windowWidth - margin) {
      left = rect.left - gap - w;
      flipped = true;
    }
    if (left < margin) {
      left = Math.min(rect.right + gap, windowWidth - w - margin);
    }

    let top = rect.top + rect.height / 2 - h / 2;
    top = Math.min(Math.max(margin, top), Math.max(margin, windowHeight - h - margin));

    const flipWorked = flipped === test.expectedFlip;
    const onScreen = left >= margin && left + w <= windowWidth - margin && top >= margin && top + h <= windowHeight - margin;

    console.log(`\n${test.name}`);
    console.log(`  Anchor: left=${rect.left}, right=${rect.right}, top=${rect.top}`);
    console.log(`  Window: ${windowWidth}x${windowHeight}, Preview: ${w}x${h}`);
    console.log(`  Result: left=${Math.round(left)}, top=${Math.round(top)}`);
    console.log(`  Flipped: ${flipped} (expected: ${test.expectedFlip}) ${flipWorked ? '✅' : '❌'}`);
    console.log(`  Fully on screen: ${onScreen} ${onScreen ? '✅' : '❌'}`);
    
    if (!onScreen) {
      console.log(`  ⚠️  Preview would be clipped!`);
      console.log(`     left=${left}, right=${left + w}, windowWidth=${windowWidth}`);
      console.log(`     top=${top}, bottom=${top + h}, windowHeight=${windowHeight}`);
    }
  });
}

// Also test the actual renderer.js logic by extracting it
console.log('=== Testing positionVolumePreview logic ===');
testPositionVolumePreview();