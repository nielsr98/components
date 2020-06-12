/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive} from '@angular/core';

@Directive({
    selector: '[cdkListboxOption]',
    exportAs: 'cdkListboxOption',
    host: {
        role: 'option',
    }
})
export class CdkListboxOption {

}

@Directive({
    selector: '[cdkListbox]',
    exportAs: 'cdkListbox',
    host: {
        role: 'listbox',
        tabindex: '0'
    }
})
export class CdkListbox {

}


