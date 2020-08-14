/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  AfterContentInit,
  ContentChildren,
  Directive,
  ElementRef, EventEmitter, forwardRef,
  Inject, InjectionToken,
  Input, OnDestroy, OnInit, Optional, Output,
  QueryList
} from '@angular/core';
import {ActiveDescendantKeyManager, Highlightable, ListKeyManagerOption} from '@angular/cdk/a11y';
import {DOWN_ARROW, END, ENTER, HOME, SPACE, UP_ARROW} from '@angular/cdk/keycodes';
import {BooleanInput, coerceBooleanProperty, coerceArray} from '@angular/cdk/coercion';
import {SelectionChange, SelectionModel} from '@angular/cdk/collections';
import {defer, merge, Observable, Subject} from 'rxjs';
import {startWith, switchMap, takeUntil} from 'rxjs/operators';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {CdkComboboxPanel} from '@angular/cdk-experimental/combobox';

let nextId = 0;
let listboxId = 0;

export const CDK_LISTBOX_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => CdkListbox),
  multi: true
};

export const PANEL = new InjectionToken<CdkComboboxPanel>('CdkComboboxPanel');

@Directive({
  selector: '[cdkOption]',
  exportAs: 'cdkOption',
  host: {
    'role': 'option',
    '(click)': 'toggle()',
    '(focus)': 'activate()',
    '(blur)': 'deactivate()',
    '[id]': 'id',
    '[attr.aria-selected]': 'selected || null',
    '[attr.tabindex]': '_getTabIndex()',
    '[attr.aria-disabled]': '_isInteractionDisabled()',
    '[class.cdk-option-disabled]': '_isInteractionDisabled()',
    '[class.cdk-option-active]': '_active',
    '[class.cdk-option-selected]': 'selected'
  }
})
export class CdkOption<T = unknown> implements ListKeyManagerOption, Highlightable {
  private _selected: boolean = false;
  private _disabled: boolean = false;
  private _value: T;
  _active: boolean = false;

  /** The id of the option, set to a uniqueid if the user does not provide one. */
  @Input() id = `cdk-option-${nextId++}`;

  @Input()
  get selected(): boolean {
    return this._selected;
  }
  set selected(value: boolean) {
    if (!this._disabled) {
      this._selected = coerceBooleanProperty(value);
    }
  }

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: boolean) {
    this._disabled = coerceBooleanProperty(value);
  }

  /** The form value of the option. */
  @Input()
  get value(): T {
    return this._value;
  }
  set value(value: T) {
    if (this.selected && value !== this._value) {
      this.deselect();
    }
    this._value = value;
  }

  @Output() readonly selectionChange: EventEmitter<OptionSelectionChangeEvent<T>> =
      new EventEmitter<OptionSelectionChangeEvent<T>>();

  constructor(private readonly _elementRef: ElementRef,
              @Inject(forwardRef(() => CdkListbox)) readonly listbox: CdkListbox<T>) {
  }

  /** Toggles the selected state, emits a change event through the injected listbox. */
  toggle() {
    if (!this._isInteractionDisabled()) {
      this.selected = !this.selected;
      this._emitSelectionChange(true);
    }
  }

  /** Sets the active property true if the option and listbox aren't disabled. */
  activate() {
    if (!this._isInteractionDisabled()) {
      this._active = true;
    }
  }

  /** Sets the active property false. */
  deactivate() {
    if (!this._isInteractionDisabled()) {
      this._active = false;
    }
  }

  /** Sets the selected property true if it was false. */
  select() {
    if (!this.selected) {
      this.selected = true;
      this._emitSelectionChange();
    }
  }

  /** Sets the selected property false if it was true. */
  deselect() {
    if (this.selected) {
      this.selected = false;
      this._emitSelectionChange();
    }
  }

  /** Applies focus to the option. */
  focus() {
    this._elementRef.nativeElement.focus();
  }

  /** Returns true if the option or listbox are disabled, and false otherwise. */
  _isInteractionDisabled(): boolean {
    return (this.listbox.disabled || this._disabled);
  }

  /** Emits a change event extending the Option Selection Change Event interface. */
  private _emitSelectionChange(isUserInput = false) {
    this.selectionChange.emit({
      source: this,
      isUserInput: isUserInput
    });
  }

  /** Returns the tab index which depends on the disabled property. */
  _getTabIndex(): string | null {
    return this._isInteractionDisabled() ? null : '-1';
  }

  /** Get the label for this element which is required by the FocusableOption interface. */
  getLabel() {
    // we know that the current node is an element type
    const clone = this._elementRef.nativeElement.cloneNode(true) as Element;
    this._removeIcons(clone);

    return clone.textContent?.trim() || '';
  }

  /** Remove any child from the given element which can be identified as an icon. */
  private _removeIcons(element: Element) {
    // TODO: make this a configurable function that can removed any desired type of node.
    for (const icon of Array.from(element.querySelectorAll('mat-icon, .material-icons'))) {
      icon.parentNode?.removeChild(icon);
    }
  }

  /** Sets the active property to true to enable the active css class. */
  setActiveStyles() {
    this._active = true;
  }

  /** Sets the active property to false to disable the active css class. */
  setInactiveStyles() {
    this._active = false;
  }

  static ngAcceptInputType_selected: BooleanInput;
  static ngAcceptInputType_disabled: BooleanInput;
}

@Directive({
  selector: '[cdkListbox]',
  exportAs: 'cdkListbox',
  host: {
    'role': 'listbox',
    '[id]': 'id',
    '(keydown)': '_keydown($event)',
    '[attr.tabindex]': '_tabIndex',
    '[attr.aria-disabled]': 'disabled',
    '[attr.aria-multiselectable]': 'multiple',
    '[attr.aria-activedescendant]': '_getAriaActiveDescendant()'
  },
  providers: [CDK_LISTBOX_VALUE_ACCESSOR]
})
export class CdkListbox<T> implements AfterContentInit, OnDestroy, OnInit, ControlValueAccessor {

  _listKeyManager: ActiveDescendantKeyManager<CdkOption<T>>;
  _selectionModel: SelectionModel<CdkOption<T>>;
  _tabIndex = 0;

  /** `View -> model callback called when select has been touched` */
  _onTouched: () => void = () => {};

  /** `View -> model callback called when value changes` */
  _onChange: (value: T) => void = () => {};

  readonly optionSelectionChanges: Observable<OptionSelectionChangeEvent<T>> = defer(() => {
    const options = this._options;

    return options.changes.pipe(
      startWith(options),
      switchMap(() => merge(...options.map(option => option.selectionChange)))
    );
  }) as Observable<OptionSelectionChangeEvent<T>>;

  private _disabled: boolean = false;
  private _multiple: boolean = false;
  private _useActiveDescendant: boolean = true;
  private _activeOption: CdkOption<T>;
  private readonly _destroyed = new Subject<void>();

  @ContentChildren(CdkOption, {descendants: true}) _options: QueryList<CdkOption<T>>;

  @Output() readonly selectionChange: EventEmitter<ListboxSelectionChangeEvent<T>> =
      new EventEmitter<ListboxSelectionChangeEvent<T>>();

  @Input() id = `cdk-option-${listboxId++}`;

  /**
   * Whether the listbox allows multiple options to be selected.
   * If `multiple` switches from `true` to `false`, all options are deselected.
   */
  @Input()
  get multiple(): boolean {
    return this._multiple;
  }
  set multiple(value: boolean) {
    this._updateSelectionOnMultiSelectionChange(value);
    this._multiple = coerceBooleanProperty(value);
  }

  @Input()
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: boolean) {
    this._disabled = coerceBooleanProperty(value);
  }

  /** Whether the listbox will use active descendant or will move focus onto the options. */
  @Input()
  get useActiveDescendant(): boolean {
    return this._useActiveDescendant;
  }
  set useActiveDescendant(shouldUseActiveDescendant: boolean) {
    this._useActiveDescendant = coerceBooleanProperty(shouldUseActiveDescendant);
  }

  @Input() compareWith: (o1: T, o2: T) => boolean = (a1, a2) => a1 === a2;

  @Input('parentPanel') private readonly _explicitPanel: CdkComboboxPanel;

  constructor(
      private readonly _elementRef: ElementRef,
      @Optional() @Inject(PANEL) readonly _parentPanel?: CdkComboboxPanel<T>,
  ) { }

  ngOnInit() {
    this._selectionModel = new SelectionModel<CdkOption<T>>(this.multiple);
  }

  ngAfterContentInit() {
    this._initKeyManager();
    this._initSelectionModel();
    this._registerWithPanel();

    this.optionSelectionChanges.subscribe(event => {
      this._emitChangeEvent(event.source);
      this._updateSelectionModel(event.source);
      this.setActiveOption(event.source);
      this._updatePanel(event.source);
    });
  }

  ngOnDestroy() {
    this._listKeyManager.change.complete();
    this._destroyed.next();
    this._destroyed.complete();
  }

  private _registerWithPanel(): void {
    const panel = this._parentPanel || this._explicitPanel;
    panel?._registerContent(this.id, 'listbox');
  }

  private _initKeyManager() {
    this._listKeyManager = new ActiveDescendantKeyManager(this._options)
        .withWrap()
        .withVerticalOrientation()
        .withTypeAhead()
        .withAllowedModifierKeys(['shiftKey']);

    this._listKeyManager.change.pipe(takeUntil(this._destroyed)).subscribe(() => {
      this._updateActiveOption();
    });
  }

  private _initSelectionModel() {
    this._selectionModel.changed.pipe(takeUntil(this._destroyed))
        .subscribe((event: SelectionChange<CdkOption<T>>) => {

      for (const option of event.added) {
        option.selected = true;
      }

      for (const option of event.removed) {
        option.selected = false;
      }
    });
  }

  _keydown(event: KeyboardEvent) {
    if (this._disabled) {
      return;
    }

    const manager = this._listKeyManager;
    const {keyCode} = event;
    const previousActiveIndex = manager.activeItemIndex;

    if (keyCode === HOME || keyCode === END) {
      event.preventDefault();
      keyCode === HOME ? manager.setFirstItemActive() : manager.setLastItemActive();

    } else if (keyCode === SPACE || keyCode === ENTER) {
      if (manager.activeItem && !manager.isTyping()) {
        this._toggleActiveOption();
      }

    } else {
      manager.onKeydown(event);
    }

    /** Will select an option if shift was pressed while navigating to the option */
    const isArrow = (keyCode === UP_ARROW || keyCode === DOWN_ARROW);
    if (isArrow && event.shiftKey && previousActiveIndex !== this._listKeyManager.activeItemIndex) {
      this._toggleActiveOption();
    }
  }

  /** Emits a selection change event, called when an option has its selected state changed. */
  _emitChangeEvent(option: CdkOption<T>) {
    this.selectionChange.emit({
      source: this,
      option: option
    });
  }

  /** Updates the selection model after a toggle. */
  _updateSelectionModel(option: CdkOption<T>) {
    if (!this.multiple && this._selectionModel.selected.length !== 0) {
      const previouslySelected = this._selectionModel.selected[0];
      this.deselect(previouslySelected);
    }

    option.selected ? this._selectionModel.select(option) :
                      this._selectionModel.deselect(option);
  }

  _updatePanel(option: CdkOption<T>) {
    if (!this.multiple) {
      const panel = this._parentPanel || this._explicitPanel;
      option.selected ? panel?.closePanel(option.value) : panel?.closePanel();
    }
  }

  /** Toggles the selected state of the active option if not disabled. */
  private _toggleActiveOption() {
    const activeOption = this._listKeyManager.activeItem;
    if (activeOption && !activeOption.disabled) {
      activeOption.toggle();
    }
  }

  /** Returns the id of the active option if active descendant is being used. */
  _getAriaActiveDescendant(): string | null | undefined {
    return this._useActiveDescendant ? this._listKeyManager?.activeItem?.id : null;
  }

  /** Updates the activeOption and the active and focus properties of the option. */
  private _updateActiveOption() {
    if (!this._listKeyManager.activeItem) {
      return;
    }

    this._activeOption?.deactivate();
    this._activeOption = this._listKeyManager.activeItem;
    this._activeOption.activate();

    if (!this.useActiveDescendant) {
      this._activeOption.focus();
    }
  }

  /** Updates selection states of options when the 'multiple' property changes. */
  private _updateSelectionOnMultiSelectionChange(value: boolean) {
    if (this.multiple && !value) {
      // Deselect all options instead of arbitrarily keeping one of the selected options.
      this.setAllSelected(false);
    } else if (!this.multiple && value) {
      this._selectionModel = new SelectionModel<CdkOption<T>>(value, this._selectionModel.selected);
    }
  }

  /** Selects the given option if the option and listbox aren't disabled. */
  select(option: CdkOption<T>) {
    if (!this.disabled && !option.disabled) {
      option.select();
    }
  }

  /** Deselects the given option if the option and listbox aren't disabled. */
  deselect(option: CdkOption<T>) {
    if (!this.disabled && !option.disabled) {
      option.deselect();
    }
  }

  /** Sets the selected state of all options to be the given value. */
  setAllSelected(isSelected: boolean) {
    for (const option of this._options.toArray()) {
      isSelected ? this.select(option) : this.deselect(option);
    }
  }

  /** Updates the key manager's active item to the given option. */
  setActiveOption(option: CdkOption<T>) {
    this._listKeyManager.updateActiveItem(option);
    this._updateActiveOption();
  }

  /**
   * Saves a callback function to be invoked when the select's value
   * changes from user input. Required to implement ControlValueAccessor.
   */
  registerOnChange(fn: (value: T) => void): void {
    this._onChange = fn;
  }

  /**
   * Saves a callback function to be invoked when the select is blurred
   * by the user. Required to implement ControlValueAccessor.
   */
  registerOnTouched(fn: () => {}): void {
    this._onTouched = fn;
  }

  /** Sets the select's value. Required to implement ControlValueAccessor. */
  writeValue(values: T | T[]): void {
    if (this._options) {
      this._setSelectionByValue(values);
    }
  }

  /** Disables the select. Required to implement ControlValueAccessor. */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  getSelectedValues(): T[] {
    return this._options.filter(option => option.selected).map(option => option.value);
  }

  /** Selects an option that has the corresponding given value. */
  private _setSelectionByValue(values: T | T[]) {
    for (const option of this._options.toArray()) {
      this.deselect(option);
    }

    const valuesArray = coerceArray(values);
    for (const value of valuesArray) {
      const correspondingOption = this._options.find((option: CdkOption<T>) => {
        return option.value != null && this.compareWith(option.value, value);
      });

      if (correspondingOption) {
        this.select(correspondingOption);
        if (!this.multiple) {
          return;
        }
      }
    }
  }

  static ngAcceptInputType_disabled: BooleanInput;
  static ngAcceptInputType_multiple: BooleanInput;
  static ngAcceptInputType_useActiveDescendant: BooleanInput;
}

/** Change event that is being fired whenever the selected state of an option changes. */
export interface ListboxSelectionChangeEvent<T> {
  /** Reference to the listbox that emitted the event. */
  readonly source: CdkListbox<T>;

  /** Reference to the option that has been changed. */
  readonly option: CdkOption<T>;
}

/** Event object emitted by CdkOption when selected or deselected. */
export interface OptionSelectionChangeEvent<T> {
  /** Reference to the option that emitted the event. */
  source: CdkOption<T>;

  /** Whether the change in the option's value was a result of a user action. */
  isUserInput: boolean;
}
