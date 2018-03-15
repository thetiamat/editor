import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/operator/takeWhile';
import 'rxjs/add/operator/takeUntil';
import 'rxjs/add/operator/reduce';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/merge';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/do';

import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { MessageService } from './../../services/message.service';

import { ControlItem } from './../../models/control-item.model';
import { Message } from './../../models/message.model';
import { Constants } from './../../constants';

import { DrawData } from '../../models/draw-data.interface';
import { Point } from '../../models/point.interface';
import { AppModel } from './../../models/app.model';

enum PointType {
    StartPoint,
    MiddlePoint,
    EndPoint
};

interface DraggablePoint {
    direction: PointType;
    point: Point;
    primitive: DrawData;
};

@Component({
    selector: 'app-canvas',
    templateUrl: './canvas.component.html',
    styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {
    @ViewChild('canvas') 
    canvas: ElementRef;

    item: ControlItem = <ControlItem>{ id: "rectangle", name: "Rectangle", isActive: false };
    selectedPrimitive?: DrawData;
    draggablePoint?: DraggablePoint;

    constructor(private messageService: MessageService, private appModel: AppModel) { }

    ngOnInit() {
        const canvas = this.canvas.nativeElement;
        this.configureCanvas(canvas);

        let draggablePoint;

        this.messageService.subscribe("size", (message) => {
            this.configureCanvas(this.canvas.nativeElement);
        });
        this.messageService.subscribe("control-item", (message) => {
            this.item = message.data;
        });
        this.messageService.subscribe(Constants.EVENT_MODEL_CHANGED, (message) => {
            switch (message.data.name) {
                case Constants.EVENT_ZOOM:
                    this.drawScene(null);
            }
        });

        // convert point to normalised coordinate space
        const toNormal = (value: number, offset: number, isGrid?: Boolean): number => {
            const nv = (value - offset) / this.appModel.zoom;
            return isGrid? this.appModel.grid * Math.round(nv / this.appModel.grid): nv;
        }

        const fromNormal = (value: number, offset: number): number => {
            return (value + offset) * this.appModel.zoom;
        }

        const pointInitiator = (start: Point, rect): DrawData => {
            if (this.draggablePoint) {
                draggablePoint = this.draggablePoint || draggablePoint;
                return draggablePoint;
            } else if ((this.item.id == Constants.ID_MOVE)) {
                const x = start.x - rect.left;
                const y = start.y - rect.top;
                return {
                    'type': this.item.id,
                    'start': { 'x': x, 'y': y },
                    'end': { 'x': x, 'y': y },
                    'points': []
                }
            } else {
                const x = toNormal(start.x - rect.left, this.appModel.offset.x, false);
                const y = toNormal(start.y - rect.top, this.appModel.offset.y, false);
                this.selectedPrimitive = {
                    'type': this.item.id,
                    'start': { 'x': x, 'y': y },
                    'end': { 'x': x, 'y': y },
                    'points': []
                }
                return this.selectedPrimitive;
            }
        }

        const pointAccumulator = (x: DrawData, y: Point): DrawData => {
            if (draggablePoint) {
                draggablePoint.point.x = toNormal(y.x, this.appModel.offset.x, false);
                draggablePoint.point.y = toNormal(y.y, this.appModel.offset.y, false);
                this.drawScene(null);
            } else if ((this.item.id == Constants.ID_MOVE)) {
                this.appModel.offset = {
                    x: this.appModel.offset.x + (y.x - x.end.x) / this.appModel.zoom,
                    y: this.appModel.offset.y + (y.y - x.end.y) / this.appModel.zoom
                }
                x.end.x = y.x;
                x.end.y = y.y;
                this.drawScene(null);
            } else {
                x.end.x = y.x = toNormal(y.x, this.appModel.offset.x, false);
                x.end.y = y.y = toNormal(y.y, this.appModel.offset.y, false);
                if (this.item.id == Constants.ID_PEN) {
                    const lastIndex = x.points.length - 1;
                    if (lastIndex >= 0 && (x.points[lastIndex].x != y.x || x.points[lastIndex].y != y.y)) {
                        x.points.push(y);
                    } else if (x.points.length == 0) {
                        x.points.push(y);
                    }
                }
                this.drawScene(x);
            }
            return x;
        }

        const addPrimitive = (data: DrawData) => {
            if (draggablePoint) {
                draggablePoint = undefined;
            } else {
                // check if it is just a click
                if (data.end.x - data.start.x < Constants.MINIMAL_SIZE && data.end.y - data.start.y < Constants.MINIMAL_SIZE) {
                    this.selectPrimitive(data);
                } else if (data.type != Constants.ID_MOVE) {
                    this.appModel.data.push(data);
                }
            }
        }

        Observable.fromEvent(canvas, 'mousedown').subscribe(
            (startEvent: MouseEvent) => {
                startEvent.preventDefault();
                startEvent.stopPropagation();
                const rect = canvas.getBoundingClientRect();
                Observable.fromEvent(document, 'mousemove')
                    .map((event: MouseEvent)  => <Point> {
                        'x': (event.pageX - rect.left),
                        'y': event.pageY - rect.top
                    })
                    .takeUntil(Observable.fromEvent(document, 'mouseup'))
                    .reduce(pointAccumulator, pointInitiator({
                        'x': startEvent.pageX,
                        'y': startEvent.pageY
                    }, rect))
                    .subscribe(
                        data => addPrimitive(data),
                        e => console.log("moveEvent error", e)
                    );
            },
            e => console.log("mousedownEvent error", e)
        );

        Observable.fromEvent(canvas, 'touchstart').subscribe(
            (startEvent: TouchEvent) => {
                startEvent.preventDefault();
                startEvent.stopPropagation();
                const rect = canvas.getBoundingClientRect();
                Observable.fromEvent(document, 'touchmove')
                    .map((event: TouchEvent)  =>  <Point> {
                        'x': event.touches[0].pageX - rect.left,
                        'y': event.touches[0].pageY - rect.top
                    })
                    .takeUntil(Observable.fromEvent(document, 'touchend'))
                    .reduce(pointAccumulator, pointInitiator({
                        'x': startEvent.touches[0].pageX,
                        'y': startEvent.touches[0].pageY
                    }, rect))
                    .subscribe(
                        data => addPrimitive(data),
                        e => console.log("moveEvent error", e)
                    );
            },
            e => console.log("touchstartEvent error", e)
        );

        Observable.fromEvent(canvas, 'wheel').subscribe(
            (wheelEvent: WheelEvent) => {
                wheelEvent.preventDefault();
                wheelEvent.stopPropagation();
                this.appModel.zoom += wheelEvent.wheelDelta > 0? Constants.DEFAULT_ZOOM_DELATA: -Constants.DEFAULT_ZOOM_DELATA;
            },
            e => console.log("wheelEvent error", e)
        );

        Observable.fromEvent(canvas, 'mousemove')
            .map((event: MouseEvent) => {
                if (this.selectedPrimitive) {
                    const rect = canvas.getBoundingClientRect();
                    const sc = Constants.SELECTION_CIRCLE;
                    const x = event.pageX - rect.left;
                    const y = event.pageY - rect.top;

                    const x1 = fromNormal(this.selectedPrimitive.start.x, this.appModel.offset.x);
                    const y1 = fromNormal(this.selectedPrimitive.start.y, this.appModel.offset.y);
                    const x2 = fromNormal(this.selectedPrimitive.end.x, this.appModel.offset.x);
                    const y2 = fromNormal(this.selectedPrimitive.end.y, this.appModel.offset.y);
                    if (x >= x1 - sc && x <= x1 + sc && y >= y1 - sc && y <= y1 + sc) {
                        return <DraggablePoint> {
                            'point': this.selectedPrimitive.start,
                            'direction': PointType.StartPoint,
                            'primitive': this.selectedPrimitive
                        };
                    } else if (x >= x2 - sc && x <= x2 + sc && y >= y2 - sc && y <= y2 + sc) {
                        return <DraggablePoint> {
                            'point': this.selectedPrimitive.end,
                            'direction': PointType.EndPoint,
                            'primitive': this.selectedPrimitive
                        };
                    } else {
                        return this.selectedPrimitive.points.filter(point => {
                            const px = fromNormal(point.x, this.appModel.offset.x);
                            const py = fromNormal(point.y, this.appModel.offset.y);
                            return x >= px - sc && x <= px + sc && y >= py - sc && y <= py + sc;
                        }).map(point => <DraggablePoint> {
                            'point': point,
                            'direction': PointType.MiddlePoint,
                            'primitive': this.selectedPrimitive
                        }).find(point => true);
                    }
                }
                return undefined;
            })
            .subscribe(
                o => {
                    if (o != undefined) {
                        this.canvas.nativeElement.style.cursor = 'move';
                        this.draggablePoint = o;
                    } else {
                        this.canvas.nativeElement.style.cursor = 'auto';
                        this.draggablePoint = undefined;
                    }
                },
                e => console.log("wheelEvent error", e)
            );
    }

    configureCanvas(canvas) {
        const styles = getComputedStyle(this.canvas.nativeElement);
        canvas.width = (styles.width)? parseInt(styles.width.replace(/[^\d^\.]*/g, '')): 0;
        canvas.height = (styles.height)? parseInt(styles.height.replace(/[^\d^\.]*/g, '')): 0;
        this.drawScene(null);
    }

    selectPrimitive(data: DrawData) {
        const area = (x1, y1, x2, y2, x3, y3) => {
            return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2.0);
        }

        const testLine = (points, point) => {
            /* Calculate area of rectangle ABCD */
            const a = area(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y)
                + area(points[0].x, points[0].y, points[3].x, points[3].y, points[2].x, points[2].y);

            /* Calculate area of triangle PAB */
            const a1 = area(point.x, point.y, points[0].x, points[0].y, points[1].x, points[1].y);
            /* Calculate area of triangle PBC */
            const a2 = area(point.x, point.y, points[1].x, points[1].y, points[2].x, points[2].y);
            /* Calculate area of triangle PCD */
            const a3 = area(point.x, point.y, points[2].x, points[2].y, points[3].x, points[3].y);
            /* Calculate area of triangle PAD */
            const a4 = area(point.x, point.y, points[0].x, points[0].y, points[3].x, points[3].y);

            return (Math.round(a) == Math.round(a1 + a2 + a3 + a4));
        }

        this.selectedPrimitive = this.appModel.data.find(o => {
            switch(o.type) {
                case Constants.ID_LINE:
                    return testLine([
                        {
                            'x': o.start.x - Constants.SELECTION_CIRCLE,
                            'y': o.start.y - Constants.SELECTION_CIRCLE
                        }, {
                            'x': o.start.x - Constants.SELECTION_CIRCLE,
                            'y': o.start.y + Constants.SELECTION_CIRCLE
                        }, {
                            'x': o.end.x - Constants.SELECTION_CIRCLE,
                            'y': o.end.y + Constants.SELECTION_CIRCLE
                        }, {
                            'x': o.end.x - Constants.SELECTION_CIRCLE,
                            'y': o.end.y - Constants.SELECTION_CIRCLE
                        }
                    ], data.start);
    
                case Constants.ID_RECTANGLE:
                    return false;
    
                case Constants.ID_PEN:
                    return false;

                default:
                    return false;
            }
        });
        this.drawScene(null);
    }

    drawScene(data: DrawData | null) {
        const canvas = this.canvas.nativeElement;
        const context = canvas.getContext("2d");

        context.clearRect(0, 0, canvas.width, canvas.height);

        this.drawGrid(canvas, context);
        this.appModel.data.forEach(o => {
            this.drawPrimitive(o, context);
        });

        if (data) {
            this.drawPrimitive(data, context);
        }

        this.drawSelection(context);
    }

    drawGrid(canvas, context) {
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
        if (this.selectedPrimitive) {
            const x1 = this.appModel.zoom * (this.appModel.offset.x + this.selectedPrimitive.start.x);
            const y1 = this.appModel.zoom * (this.appModel.offset.y + this.selectedPrimitive.start.y);
            const x2 = this.appModel.zoom * (this.appModel.offset.x + this.selectedPrimitive.end.x);
            const y2 = this.appModel.zoom * (this.appModel.offset.y + this.selectedPrimitive.end.y);

            context.beginPath();
            context.arc(x1, y1, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            context.arc(x2, y2, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
            context.stroke();

            this.selectedPrimitive.points.forEach((o, index) => {
                const x = this.appModel.zoom * (this.appModel.offset.x + o.x);
                const y = this.appModel.zoom * (this.appModel.offset.y + o.y);
                context.beginPath();
                context.arc(x, y, Constants.SELECTION_CIRCLE, 0, 2 * Math.PI);
                context.stroke();
            });
        }
    }

    drawPrimitive(data: DrawData, context) {
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
