import { Injectable } from '@angular/core';

import { Primitive } from '../models/primitive.interface';
import { AppModel } from '../models/app.model';
import { UtilsService } from './utils.service';
import { Constants } from '../constants';

@Injectable()
export class DrawService {

    constructor(private appModel: AppModel, private utilsService: UtilsService) { }

    drawZero(canvas, context) {
        const zeroPoint = this.utilsService.fromNormal(Constants.ZERO_POINT);
        if (zeroPoint.x >= 0 && zeroPoint.x <= canvas.width && zeroPoint.y >= 0 && zeroPoint.y <= canvas.height) {
            context.beginPath();
            context.arc(zeroPoint.x, zeroPoint.y, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
            context.fill();
        }
    }

    drawGrid(canvas, context) {
        if (!isNaN(this.appModel.grid)) {
            const constOffsetDelta = {
                x: this.appModel.offset.x % this.appModel.grid * this.appModel.zoom,
                y: this.appModel.offset.y % this.appModel.grid * this.appModel.zoom,
            };
            context.beginPath();
            for (let y = constOffsetDelta.y; y < canvas.height; y += this.appModel.grid * this.appModel.zoom) {
                context.setLineDash([1, this.appModel.grid * this.appModel.zoom - 1]);
                context.moveTo(constOffsetDelta.x, y);
                context.lineTo(canvas.width, y);
            }
            context.stroke();
            context.setLineDash([]);
        }
    }

    drawNet(canvas, context) {
        if (!isNaN(this.appModel.net)) {
            const constOffsetDelta = {
                x: this.appModel.offset.x % this.appModel.net * this.appModel.zoom,
                y: this.appModel.offset.y % this.appModel.net * this.appModel.zoom,
            };
            context.beginPath();
            let index = 0;
            for (let x = constOffsetDelta.x; x < canvas.width; x += this.appModel.net * this.appModel.zoom, index++) {
                if (index % this.appModel.net2 == 0) {
                    context.stroke();
                    context.beginPath();
                    context.moveTo(x, 0);
                    context.lineTo(x, canvas.height);
                    context.lineWidth=2;
                    context.stroke();
                    context.beginPath();
                    context.lineWidth=1;
                } else {
                    context.moveTo(x, 0);
                    context.lineTo(x, canvas.height);
                }
            }
            index = 0;
            for (let y = constOffsetDelta.y; y < canvas.height; y += this.appModel.net * this.appModel.zoom, index++) {
                if (index % this.appModel.net2 == 0) {
                    context.stroke();
                    context.beginPath();
                    context.moveTo(0, y);
                    context.lineTo(canvas.width, y);
                    context.lineWidth=2;
                    context.stroke();
                    context.beginPath();
                    context.lineWidth=1;
                } else {
                    context.moveTo(0, y);
                    context.lineTo(canvas.width, y);
                }
            }
            context.stroke();
        }
    }

    drawLine(x1, y1, x2, y2, data, context) {
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
    }

    drawRect(x1, y1, x2, y2, data, context) {
        context.beginPath();
        context.rect(x1, y1, x2 - x1, y2 - y1);
        context.stroke();
    }

    drawPen(x1, y1, x2, y2, data, context) {
        context.beginPath();
        context.moveTo(x1, y1);
        data.points.forEach((o, index) => {
            const x = this.appModel.zoom * (this.appModel.offset.x + o.x);
            const y = this.appModel.zoom * (this.appModel.offset.y + o.y);
            context.lineTo(x, y);
            context.moveTo(x, y);
        });
        context.stroke();
    }

    drawSelection(context) {
        if (this.appModel.selectedPrimitive) {
            const x1 = this.appModel.zoom * (this.appModel.offset.x + this.appModel.selectedPrimitive.start.x);
            const y1 = this.appModel.zoom * (this.appModel.offset.y + this.appModel.selectedPrimitive.start.y);
            const x2 = this.appModel.zoom * (this.appModel.offset.x + this.appModel.selectedPrimitive.end.x);
            const y2 = this.appModel.zoom * (this.appModel.offset.y + this.appModel.selectedPrimitive.end.y);

            context.beginPath();
            context.arc(x1, y1, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            context.arc(x2, y2, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
            context.stroke();

            this.appModel.selectedPrimitive.points.forEach((o, index) => {
                const x = this.appModel.zoom * (this.appModel.offset.x + o.x);
                const y = this.appModel.zoom * (this.appModel.offset.y + o.y);
                context.beginPath();
                context.arc(x, y, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
                context.stroke();
            });
        }
    }

    drawPrimitive(data: Primitive, context) {
        const x1 = this.appModel.zoom * (this.appModel.offset.x + data.start.x);
        const y1 = this.appModel.zoom * (this.appModel.offset.y + data.start.y);
        const x2 = this.appModel.zoom * (this.appModel.offset.x + data.end.x);
        const y2 = this.appModel.zoom * (this.appModel.offset.y + data.end.y);

        switch(data.type) {
            case Constants.ID_LINE:
                return this.drawLine(x1, y1, x2, y2, data, context);

            case Constants.ID_RECTANGLE:
                return this.drawRect(x1, y1, x2, y2, data, context);

            case Constants.ID_PEN:
                return this.drawPen(x1, y1, x2, y2, data, context);
        }
    }
}