const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'assets/models');

const files = fs.readdirSync(modelsDir);

files.forEach(file => {
    if (file.endsWith('manifest.json')) {
        const manifestPath = path.join(modelsDir, file);
        const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Update paths in manifest
        content.forEach(group => {
            group.paths = group.paths.map(p => {
                if (!p.endsWith('.bin')) {
                    return p + '.bin';
                }
                return p;
            });
        });

        fs.writeFileSync(manifestPath, JSON.stringify(content, null, 2));
        console.log(`Updated manifest: ${file}`);
    } else if (!file.endsWith('.json') && !file.endsWith('.bin')) {
        // Rename shard files
        const oldPath = path.join(modelsDir, file);
        const newPath = oldPath + '.bin';
        if (!fs.existsSync(newPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed: ${file} -> ${file}.bin`);
        }
    }
});
