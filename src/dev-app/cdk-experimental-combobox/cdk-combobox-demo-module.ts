/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {CdkComboboxModule} from '@angular/cdk-experimental/combobox';
import {CdkComboboxDemo} from './cdk-combobox-demo';
import {CdkListboxModule} from "@angular/cdk-experimental/listbox";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {FormsModule} from "@angular/forms";
import {MatIconModule} from "@angular/material/icon";

@NgModule({
  imports: [
    CdkComboboxModule,
    CommonModule,
    RouterModule.forChild([{path: '', component: CdkComboboxDemo}]),
    CdkListboxModule,
    MatCheckboxModule,
    FormsModule,
    MatIconModule
  ],
  declarations: [CdkComboboxDemo],
})
export class CdkComboboxDemoModule {}
