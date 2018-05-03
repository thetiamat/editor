import { Injectable } from '@angular/core';

import { Constants } from '../constants';

import { AppModel } from '../models/app.model';


@Injectable()
export class UtilsService {
    constructor(private appModel: AppModel) { }

    toNormal(point: Point, isGrid?: Boolean): Point {
        const normal = {
            'x': point.x / this.appModel.zoom - this.appModel.offset.x,
            'y': point.y / this.appModel.zoom - this.appModel.offset.y
        };
        return {
            'x': isGrid? this.appModel.grid * Math.round(normal.x / this.appModel.grid): normal.x,
            'y': isGrid? this.appModel.grid * Math.round(normal.y / this.appModel.grid): normal.y
        }
    }

    fromNormal(point: Point): Point {
        return {
            'x': (point.x + this.appModel.offset.x) * this.appModel.zoom,
            'y': (point.y + this.appModel.offset.y) * this.appModel.zoom
        }
    }

    getXofLine(a: Point, b: Point, y: number) {
        //(x2-x1)*(y-y1)=(y2-y1)*(x-x1)
        //ab.x*(y-y1)/ab.y+x1=x
        const ab = {
            'x': b.x - a.x,
            'y': b.y - a.y,
        }
        return ab.x * (y - a.y) / ab.y + a.x;
    }

    // check if elipse close enough to point
    testEllipse(a: Point, b: Point, point: Point, context?: any) {
        // the biggest radius
        const e0 = Math.abs(b.x - a.x) > Math.abs(b.y - a.y)? Math.abs(b.x - a.x): Math.abs(b.y - a.y);
        // the smallest radius
        const e1 = Math.abs(b.x - a.x) > Math.abs(b.y - a.y)? Math.abs(b.y - a.y): Math.abs(b.x - a.x);

        // makes center of ellipse be the center of axis
        const dc:Point = {
            'x': point.x - a.x,
            'y': point.y - a.y
        };

        // calculates the intersection between line from center of ellipse and point and ellipse
        // line equation y = y0 / x0 * x
        // ellipse equation x * x / e0 * e0 + y * y / e1 * e1 = 1
        let d:Point = {
            'x': e0 * e1 / Math.sqrt(e0 * e0 * dc.y * dc.y + e1 * e1 * dc.x * dc.x) * dc.x,
            'y': e0 * e1 / Math.sqrt(e0 * e0 * dc.y * dc.y + e1 * e1 * dc.x * dc.x) * dc.y
        };
        // translates intersection to scene axis
        d = {
            'x': d.x + a.x,
            'y': d.y + a.y
        };

        if (context) {
            point = this.fromNormal(point);
            d = this.fromNormal(d);

            //draw projection line
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(d.x, d.y);
            context.stroke();
        }

        const xd = point.x  - d.x;
        const yd = point.y  - d.y
        const dist = xd * xd + yd * yd;

        const screenDist = Constants.SELECTION_CIRCLE / this.appModel.zoom
        return (dist < screenDist* screenDist)? true: false;
    }

    // check if line close enough to point
    testLine(a: Point, b: Point, point: Point, context?: any) {
        const ab = {
            'x': b.x - a.x,
            'y': b.y - a.y,
        }
        const ac = {
            'x': point.x - a.x,
            'y': point.y - a.y,
        }
        const bc = {
            'x': point.x - b.x,
            'y': point.y - b.y,
        }
        const e = this.dotProduction(ac, ab);
        let dist = NaN;
        if (e <= 0.0) {
            dist = this.dotProduction(ac, ac);
        } else {
            const f = this.dotProduction(ab, ab);
            if (e >= f) {
                dist = this.dotProduction(bc, bc);
            } else {
                dist = this.dotProduction(ac, ac) - e * e / f;
            }
        }
        const screenDist = Constants.SELECTION_CIRCLE / this.appModel.zoom
        return (dist < screenDist * screenDist)? true: false;
    }

    // check if edge of primitive close enough to point
    testPrimitive(prim: Primitive, point: Point): boolean {
        switch(prim.type) {
            case Constants.ID_LINE:
            case Constants.ID_SIZE:
                return this.testLine(prim.start, prim.end, point);

            case Constants.ID_ARC:
                //const canvas = this.canvas.nativeElement;
                //const context = canvas.getContext("2d");
                return this.testEllipse(prim.start, prim.end, point);

            case Constants.ID_RECTANGLE:
                return this.testLine(prim.start, {
                    'x': prim.start.x,
                    'y': prim.end.y
                }, point) || this.testLine({
                    'x': prim.start.x,
                    'y': prim.end.y
                }, prim.end, point) || this.testLine(prim.end, {
                    'x': prim.end.x,
                    'y': prim.start.y
                }, point) || this.testLine({
                    'x': prim.end.x,
                    'y': prim.start.y
                }, prim.start, point);

            case Constants.ID_PEN:
                const pen = <PrimitivePen>prim;
                return pen.points.reduce((x, y) => {
                    return {
                        'res': x.res || this.testLine(x.point, y, point),
                        'point': y
                    }
                }, {
                    'res': false,
                    'point': prim.start
                }).res;

            default:
                return false;
        };
    }

    // get closest point to line
    closestLinePoint(a: Point, b: Point, point: Point) {
        const ab = {
            'x': b.x - a.x,
            'y': b.y - a.y,
        }
        const ac = {
            'x': point.x - a.x,
            'y': point.y - a.y,
        }
        const bc = {
            'x': point.x - b.x,
            'y': point.y - b.y,
        }
        // project point into ab, computing parametrized position d(t) = a + t * (b - a)
        let t = this.dotProduction(ac, ab) / this.dotProduction(ab, ab);

        // if point outside ab, attach t to the closest endpoint
        if (t < 0.0) t = 0.0;
        if (t > 1.0) t = 1.0;

        // compute the closest point on ab
        return {
            'x': ab.x * t + a.x,
            'y': ab.y * t + a.y
        }
    }

    // get closest point to primitive
    getClosestPrimitivePoint(prim: Primitive, p: Point): Point {
        switch (prim.type) {
            case Constants.ID_LINE:
                return this.closestLinePoint(prim.start, prim.end, p);
        }
        return p;
    }

    // return point of primitive
    getPrimitivePoint(o: Primitive, sp: Point) {
        const sc = Constants.SELECTION_CIRCLE;
        const p1 = this.fromNormal(o.start);
        const p2 = this.fromNormal(o.end);
        if (sp.x >= p1.x - sc && sp.x <= p1.x + sc && sp.y >= p1.y - sc && sp.y <= p1.y + sc) {
            return <PrimitivePoint> {
                'point': o.start,
                'direction': PointType.StartPoint,
                'primitive': this.appModel.selectedPrimitive
            };
        } else if (sp.x >= p2.x - sc && sp.x <= p2.x + sc && sp.y >= p2.y - sc && sp.y <= p2.y + sc) {
            return <PrimitivePoint> {
                'point': o.end,
                'direction': PointType.EndPoint,
                'primitive': this.appModel.selectedPrimitive
            };
        } else if (o.type == Constants.ID_PEN) {
            const pen = <PrimitivePen>o;
            return pen.points.filter(point => {
                const p = this.fromNormal(point);
                return sp.x >= p.x - sc && sp.x <= p.x + sc && sp.y >= p.y - sc && sp.y <= p.y + sc;
            }).map(point => <PrimitivePoint> {
                'point': point,
                'direction': PointType.MiddlePoint,
                'primitive': this.appModel.selectedPrimitive
            }).find(point => true);
        }
    }

    // clone object
    clone(object: any, isDeep: Boolean): any {
        if (typeof(object) == 'object') {
            if (Array.isArray(object)) {
                return object.map(o => this.clone(o, isDeep));
            } else if (object instanceof Map) {
                var mobj = new Map;
                Array.from(object.entries()).forEach(o => {
                    mobj.set(o[0], this.clone(o[1], isDeep))
                });
                return mobj;
            } else {
                var oobj = {};
                Object.keys(object).forEach(o => {
                    oobj[o] = this.clone(object[o], isDeep);
                });
                return oobj;
            }
        } else {
            return object;
        }
    }

    // translate to canvas rect
    getScreenPoint(rect, px, py): Point {
        return {
            'x': px - rect.left,
            'y': py - rect.top
        };
    }

    //Factory to create primitives
    createPrimitive(type: string | undefined, point: Point): Primitive | undefined {
        switch (type) {
            case Constants.ID_ARC:
                return <Primitive> {
                    'id': Date.now().toString(),
                    'type': type,
                    'start': point,
                    'end': { 'x': point.x, 'y': point.y },
                    'startAngle': 0,
                    'endAngle': 2 * Math.PI
                };

            case Constants.ID_PEN:
                return <Primitive> {
                    'id': Date.now().toString(),
                    'type': type,
                    'start': point,
                    'end': { 'x': point.x, 'y': point.y },
                    'points': []
                };
            case Constants.ID_LINE:
            case Constants.ID_RECTANGLE:
                return <Primitive> {
                    'id': Date.now().toString(),
                    'type': type,
                    'start': point,
                    'end': { 'x': point.x, 'y': point.y }
                }

            default:
                return undefined;

        }
    }

    private dotProduction(x: Point, y: Point) {
        return x.x * y.x + x.y * y.y;
    }
}
