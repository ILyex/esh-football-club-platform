const fs = require('fs');

['.env', '.env.local'].forEach(file => {
  console.log('=== ' + file + ' ===');
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach(line => {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (match) {
        console.log(match[1]);
      }
    });
  } else {
    console.log('File does not exist');
  }
});
