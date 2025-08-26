class Visualizer {
    static drawNetwork(ctx, network) {
        const margin = 50;
        const left = margin;
        const top = margin;
        const width = ctx.canvas.width - margin * 2;
        const height = ctx.canvas.height - margin * 2;
        const levelHeight = height / network.levels.length;
        for (let i = network.levels.length - 1; i >= 0; i--) {
            const levelTop = top + (network.levels.length - 1 - i) * levelHeight;
            const isOutput = i === network.levels.length - 1;
            Visualizer.drawLevel(ctx, network.levels[i], left, levelTop, width, levelHeight, isOutput);
        }
    }
    static drawLevel(ctx, level, left, top, width, height, isOutput = false) {
        const right = left + width;
        const bottom = top + height;
        const inputsCount = level.inputs.length;
        const outputsCount = level.outputs.length;
        const nodeRadius = 18;

        // helper to compute x position for a node index in a row
        const xPos = (index, total) => lerp(left, right, total === 1 ? 0.5 : index / (total - 1));

        // draw connections
        for (let i = 0; i < inputsCount; i++) {
            for (let j = 0; j < outputsCount; j++) {
                const x1 = xPos(i, inputsCount);
                const y1 = bottom;
                const x2 = xPos(j, outputsCount);
                const y2 = top;

                const weight = level.weights[i][j];
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineWidth = Math.max(1, Math.abs(weight) * 3);
                // positive weights green, negative weights red
                ctx.strokeStyle = weight > 0 ? `rgba(0,150,0,${Math.min(1, Math.abs(weight))})` : `rgba(150,0,0,${Math.min(1, Math.abs(weight))})`;
                ctx.stroke();
            }
        }

        // draw input nodes
        for (let i = 0; i < inputsCount; i++) {
            const x = xPos(i, inputsCount);
            const y = bottom;
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }

    // draw output nodes and bias indicators
        for (let j = 0; j < outputsCount; j++) {
            const x = xPos(j, outputsCount);
            const y = top;

            // node
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();

            // inner fill representing activation (if available)
            const outputVal = level.outputs[j];
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0,${outputVal})`;
            ctx.fill();

            // bias indicator (stroke color + alpha)
            const bias = level.biases[j];
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius * 0.9, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = bias > 0 ? `rgba(0,150,0,${Math.min(1, Math.abs(bias))})` : `rgba(150,0,0,${Math.min(1, Math.abs(bias))})`;
            ctx.stroke();
        }

        // if this is the final output layer and it matches the car controls (4 outputs),
        // draw directional arrows for forward/left/right/reverse above each output node
        if (isOutput && outputsCount === 4) {
            const dirs = ['up', 'left', 'right', 'down']; // mapping: 0->forward(up),1->left,2->right,3->reverse(down)
            const arrowSize = 14;
            for (let j = 0; j < outputsCount; j++) {
                const x = xPos(j, outputsCount);
                const y = top - nodeRadius - 8;
                const activation = level.outputs[j] || 0;
                const alpha = Math.min(1, Math.abs(activation));
                const color = activation > 0.5 ? `rgba(0,150,0,${alpha})` : `rgba(0,0,0,${Math.max(0.18, alpha*0.8)})`;
                // draw a triangular arrow
                ctx.save();
                ctx.translate(x, y);
                let angle = 0;
                switch(dirs[j]){
                    case 'up': angle = 0; break;
                    case 'right': angle = Math.PI/2; break;
                    case 'down': angle = Math.PI; break;
                    case 'left': angle = -Math.PI/2; break;
                }
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, -arrowSize);
                ctx.lineTo(-arrowSize*0.6, arrowSize*0.8);
                ctx.lineTo(arrowSize*0.6, arrowSize*0.8);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                ctx.restore();
            }
        }
    }
}