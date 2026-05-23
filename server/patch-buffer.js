import fs from 'fs';
import path from 'path';

const fileToPatch = path.join(process.cwd(), 'node_modules', 'buffer-equal-constant-time', 'index.js');

if (fs.existsSync(fileToPatch)) {
    let content = fs.readFileSync(fileToPatch, 'utf8');
    content = content.replace(
        "var SlowBuffer = require('buffer').SlowBuffer;",
        "var SlowBuffer = require('buffer').SlowBuffer || require('buffer').Buffer;"
    );
    fs.writeFileSync(fileToPatch, content, 'utf8');
    console.log('Successfully patched buffer-equal-constant-time for Node.js 22+ compatibility.');
} else {
    console.log('Patch target not found, skipping.');
}
