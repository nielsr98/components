/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component} from '@angular/core';
import {FormControl} from '@angular/forms';

@Component({
  templateUrl: 'cdk-listbox-demo.html',
  styleUrls: ['cdk-listbox-demo.css'],
})
export class CdkListboxDemo {
  multiSelectable = false;
  activeDescendant = false;
  formControl = new FormControl();

  disableForm() {
    this.formControl.disable();
  }

  enableForm() {
    this.formControl.enable();
  }

  toggleMultiple() {
    this.multiSelectable = !this.multiSelectable;
  }

  toggleActiveDescendant() {
    this.activeDescendant = !this.activeDescendant;
  }
}
