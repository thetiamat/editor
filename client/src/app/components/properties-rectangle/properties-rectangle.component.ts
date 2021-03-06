import { Component, OnInit } from '@angular/core';

import { MessageService } from '../../services/message.service';
import { AppModel } from '../../models/app.model';

@Component({
    //selector: 'app-properties-rectangle',
    templateUrl: './properties-rectangle.component.html',
    styleUrls: ['./properties-rectangle.component.scss']
})
export class PropertiesRectangleComponent implements OnInit {
    constructor(private appModel: AppModel, private messageService: MessageService) { }

    primitive: Primitive;

    ngOnInit() {
        if (this.appModel.selectedPrimitive) {
            this.primitive = this.appModel.selectedPrimitive;
        }
    }

    update() {
        if (this.appModel.selectedPrimitive) { 
            this.appModel.selectedPrimitive = this.appModel.selectedPrimitive;
        }
    }
}
