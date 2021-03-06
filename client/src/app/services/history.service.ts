import { Injectable } from '@angular/core';

import { UtilsService } from './utils.service';
import { AppModel } from '../models/app.model';
import { Constants } from '../constants';

@Injectable()
export class HistoryService {
    private currentHistory = 0;

    constructor(private appModel: AppModel,
        private utilsService: UtilsService) {
    }

    snapshoot() {
        while (this.currentHistory > 0) {
            this.currentHistory--;
            this.appModel.history.shift();
        }

        //this.appModel.data.map(o => this.utilsService.clone(o, true))
        this.appModel.history.unshift(this.utilsService.clone(this.appModel.data, true));
        
        // remove last history entity if size exceeded
        if (this.appModel.history.length > Constants.MAXIMUM_HISTORY) {
            this.appModel.history.pop();
        }

        // generate history update event
        this.appModel.history = this.appModel.history;
    }

    next() {
        if (this.currentHistory > 0) {
            // get next app data from history
            this.appModel.selectedPrimitive = undefined;

            //this.appModel.data = this.appModel.history[--this.currentHistory].map(o => this.utilsService.clone(o, false));
            this.appModel.data = this.utilsService.clone(this.appModel.history[--this.currentHistory], false);

            // generate history event
            this.appModel.history = this.appModel.history;
        }
    }

    back() {
        if (this.currentHistory + 1 < this.appModel.history.length) {
            // get previous app data from history
            this.appModel.selectedPrimitive = undefined;

            //this.appModel.data = this.appModel.history[++this.currentHistory].map(o => this.utilsService.clone(o, false));
            this.appModel.data = this.utilsService.clone(this.appModel.history[++this.currentHistory], false);

            // generate history event
            this.appModel.history = this.appModel.history;
        }
    }
}
