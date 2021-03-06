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

import { ControlItem } from './../../models/control-item.model';
import { Message } from './../../models/message.model';
import { Constants } from './../../constants';

import { MessageService } from './../../services/message.service';
import { HistoryService } from '../../services/history.service';
import { UtilsService } from '../../services/utils.service';
import { DrawService } from '../../services/draw.service';
import { AppModel } from './../../models/app.model';

@Component({
    selector: 'div[app-canvas]',
    templateUrl: './canvas.component.html',
    styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {
    @ViewChild('canvas')
    canvas: ElementRef;

    constructor(private appModel: AppModel,
        private messageService: MessageService,
        private drawService: DrawService,
        private utilsService: UtilsService,
        private historyService: HistoryService) {
    }

    ngOnInit() {
        const canvas = this.canvas.nativeElement;

        // edit state
        let draggablePoint: PrimitivePoint | undefined;

        this.messageService.subscribe(Constants.EVENT_MODEL_CHANGED, (message) => {
            switch (message.data.name) {
                case Constants.EVENT_HISTORY:
                    return this.drawScene(null);

                case Constants.EVENT_ZOOM:
                    return this.drawScene(null);

                case Constants.EVENT_GRID:
                    return this.drawScene(null);

                case Constants.EVENT_SELECTED_PRIMITIVE:
                    return this.drawScene(null);

                case Constants.EVENT_SIZE:
                    return this.resizeCanvas();
            }
        });

        const pointInitiator = (start: Point): Primitive | undefined => {
            const pp = this.utilsService.getPrimitivePoint(this.appModel.selectedPrimitive, start);
            if (pp) { // editing primitive state
                draggablePoint = pp;
                return draggablePoint.primitive;
            } else if (this.appModel.selectedTool == Constants.TYPE_MOVE) { // moving page state
                return <Primitive> {
                    'id': Date.now().toString(),
                    'type': this.appModel.selectedTool,
                    'start': { 'x': start.x, 'y': start.y },
                    'end': { 'x': start.x, 'y': start.y }
                }
            } else { // creating primitive state
                const point = this.utilsService.toNormal({
                    'x': start.x,
                    'y': start.y
                }, false);
                this.appModel.selectedPrimitive = this.utilsService.createPrimitive(this.appModel.selectedTool, point);
                return this.appModel.selectedPrimitive;
            }
        }

        const pointAccumulator = (x: Primitive | undefined, y: Point): Primitive | undefined => {
            if (!x) {
                return undefined;
            }

            const point = this.utilsService.toNormal(y, false);
            if (draggablePoint) { // editing primitive state
                if (draggablePoint.primitive.type == Constants.TYPE_SIZE) { // size primitive has special logic
                    this.utilsService.moveSizePrimitive(<PrimitiveSize>draggablePoint.primitive, draggablePoint.pointType, point);
                } else {
                    this.utilsService.movePrimitive(draggablePoint.primitive, draggablePoint, point);
                }
                this.drawScene(null);
            } else if (this.appModel.selectedTool == Constants.TYPE_MOVE) { // moving page state
                this.appModel.offset = {
                    x: this.appModel.offset.x + (y.x - x.end.x) / this.appModel.zoom,
                    y: this.appModel.offset.y + (y.y - x.end.y) / this.appModel.zoom
                }
                x.end.x = y.x;
                x.end.y = y.y;
                this.drawScene(null);
            } else { // creating primitive state
                x.end.x = y.x = point.x;
                x.end.y = y.y = point.y;
                this.drawScene(x);
            }
            return x;
        }

        const addPrimitive = (data: Primitive) => {
            if (draggablePoint) {
                draggablePoint = undefined;
                this.historyService.snapshoot();
            } else if (data.type == Constants.TYPE_LINE ||
                data.type == Constants.TYPE_RECTANGLE ||
                data.type == Constants.TYPE_ARC) {

                this.utilsService.addPrimitive(data)
                this.historyService.snapshoot();
            }
        }

        const isSelectionOrMoving = (start, end) => {
            if (Math.abs(end.x - start.x) <= Constants.MINIMAL_SIZE && Math.abs(end.y - start.y) <= Constants.MINIMAL_SIZE)
                return true;
            else 
                return false;
        }

        // handle clicks to select primitive, it isn't moving--------
        let firstPoint;
        const selectionFinished = (start: Point, end: Point) => {
            if (isSelectionOrMoving(start, end)) {
                const point = this.utilsService.toNormal({
                    'x': start.x + (end.x - start.x) / 2,
                    'y': start.y + (end.y - start.y) / 2,
                });
                const pp = this.selectPrimitive(point);
                if (this.appModel.selectedTool == Constants.TYPE_SIZE) {
                    if (!firstPoint) {
                        firstPoint = pp;
                    } else if (pp) {
                        if(this.utilsService.createSizePrimitive(
                            firstPoint,
                            pp
                        )) {
                            this.historyService.snapshoot();
                        }

                        // clear creation state
                        this.appModel.selectedTool = firstPoint = undefined;
                    }
                } else {
                    firstPoint = undefined;
                }
            }
        };

        let startPoint: Point | undefined; // position of mouse or touch down
        canvas.onmousedown = (e: MouseEvent)  => {
            if (e.buttons == 1) {
                startPoint = this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), e.pageX, e.pageY);
            }
        }
        canvas.onmouseup = (e: MouseEvent)  => {
            if (startPoint) {
                selectionFinished(startPoint, this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), e.pageX, e.pageY));
            }
            startPoint = undefined;
        }
        canvas.ontouchstart = (e: TouchEvent)  => {
            startPoint = this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), e.touches[0].pageX, e.touches[0].pageY);
        }
        canvas.ontouchend = (e: TouchEvent)  => {
            if (startPoint) {
                selectionFinished(startPoint, this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), e.touches[0].pageX, e.touches[0].pageY));
            }
            startPoint = undefined;
        }

        // handle moving to add, edit primitive and etc, it isn't click ----------------
        let movingSubscription; // true if moving event need to be subscribed
        canvas.onmousemove = (event: MouseEvent)  => { //start moving if delta is reached and show move cursor if mouse on point
            const sp = this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), event.pageX, event.pageY);

            // shows moving cursor if there isn't moving and primitive is selected
            // saves active primitive point to draggablePoint
            if (!movingSubscription && this.appModel.selectedPrimitive) {
                const cursor = this.canvas.nativeElement.style.cursor;
                if (!this.utilsService.getPrimitivePoint(this.appModel.selectedPrimitive, sp)) {
                    if (cursor != 'auto') {
                        canvas.style.cursor = 'auto';
                    }
                } else {
                    if (cursor != 'move') {
                        canvas.style.cursor = 'move';
                    }
                }
            }

            // trigger moving if delta is reached and there isn't other moving
            if (!movingSubscription && startPoint && !isSelectionOrMoving(startPoint, sp)) {
                movingSubscription = Observable.fromEvent(document, 'mousemove')
                    .map((event: MouseEvent)  => this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), event.pageX, event.pageY))
                    .takeUntil(Observable.fromEvent(document, 'mouseup'))
                    .reduce(pointAccumulator, pointInitiator(startPoint))
                    .subscribe(
                        data => {
                            movingSubscription.unsubscribe();
                            movingSubscription = undefined;
                            startPoint = undefined;
                            if (data) {
                                addPrimitive(data);
                            }
                        },
                        e => console.log("moveEvent error", e)
                    );
            }
        }

        canvas.ontouchmove = (event: TouchEvent)  => { //start moving if delta is reached
            const sp = this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), event.touches[0].pageX, event.touches[0].pageY);

            // trigger moving if delta is reached and there isn't other moving
            if (!movingSubscription && startPoint && !isSelectionOrMoving(startPoint, sp)) {
                movingSubscription = Observable.fromEvent(document, 'touchmove')
                    .map((event: TouchEvent)  => this.utilsService.getScreenPoint(canvas.getBoundingClientRect(), event.touches[0].pageX, event.touches[0].pageY))
                    .takeUntil(Observable.fromEvent(document, 'touchend'))
                    .reduce(pointAccumulator, pointInitiator(startPoint))
                    .subscribe(
                        data => {
                            movingSubscription.unsubscribe();
                            movingSubscription = undefined;
                            startPoint = undefined;
                            if (data) {
                                addPrimitive(data);
                            }
                        },
                        e => console.log("touchmoveEvent error", e)
                    );
            }
        }
        // zoom ---------------------
        Observable.fromEvent(canvas, 'wheel').subscribe(
            (wheelEvent: WheelEvent) => {
                wheelEvent.preventDefault();
                wheelEvent.stopPropagation();
                this.appModel.zoom += wheelEvent.wheelDelta > 0? Constants.DEFAULT_ZOOM_DELATA: -Constants.DEFAULT_ZOOM_DELATA;
            },
            e => console.log("wheelEvent error", e)
        );
        // --------------------------
    }

    resizeCanvas() {
        let canvas = this.canvas.nativeElement;
        const styles = getComputedStyle(canvas);
        canvas.width = (styles.width)? parseInt(styles.width.replace(/[^\d^\.]*/g, '')): 0;
        canvas.height = (styles.height)? parseInt(styles.height.replace(/[^\d^\.]*/g, '')): 0;
        this.drawScene(null);

        //if (styles.width && styles.height) {
        //    console.log('resize: ' + parseInt(styles.width.replace(/[^\d^\.]*/g, '')) + ', ' + parseInt(styles.height.replace(/[^\d^\.]*/g, '')));
        //}
    }

    selectPrimitive(point: Point): PrimitivePoint | undefined {
        const pp = Array.from(this.appModel.data.values()).map(o => this.utilsService.testPrimitive(o, point)).find(o => !!o);
        if (pp) {
            this.appModel.selectedPrimitive = pp.primitive;
        }
        return pp;
    }

    drawScene(data: Primitive | null) {
        const canvas = this.canvas.nativeElement;
        const context = canvas.getContext("2d");

        context.clearRect(0, 0, canvas.width, canvas.height);

        this.drawService.drawZero(canvas, context);
        this.drawService.drawGrid(canvas, context);
        this.drawService.drawNet(canvas, context);
        this.appModel.data.forEach(o => {
            this.drawService.drawPrimitive(o, context);
        });

        if (data) {
            this.drawService.drawPrimitive(data, context, !isNaN(this.appModel.grid));
        }

        this.drawService.drawSelection(context, !isNaN(this.appModel.grid));
    }
}
