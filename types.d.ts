declare module 'input' {
  /** Accepts a single line of plain text input from the user */
  export function text(label?: string, options?: Options): Promise<string>;
  export function text(options: Options): Promise<string>;
  /** Accepts a single line of plain text input from the user but the user's typing is presented as asterisks */
  export function password(label?: string, options?: Options): Promise<string>;
  export function password(options: Options): Promise<string>;
  /** Shows the user a list of choices. The user can move up and down with arrow keys, then press return to select the highlighted choice */
  export function select(
    label: string,
    choices: SelectChoices,
    options?: Options
  ): Promise<string>;
  export function select(
    choices: SelectChoices,
    options?: Options
  ): Promise<string>;
  /** Shows the user a list of choices. The user can move up and down with arrow keys, then press return to select the highlighted choice. The user may select multiple choices (or none at all) */
  export function checkboxes(
    label: string,
    choices: CheckboxChoices,
    options?: CheckboxOptions
  ): Promise<string[]>;
  export function checkboxes(
    choices: CheckboxChoices,
    options?: CheckboxOptions
  ): Promise<string[]>;
  /** A classic Y/n confirmation dialogue. The user may type y or n (case-insensitive) then press return to answer true or false. The user may alternatively just press return to choose the capitalised answer */
  export function confirm(
    label?: string,
    options?: ConfirmOptions
  ): Promise<boolean>;
  export function confirm(options: ConfirmOptions): Promise<boolean>;
}

interface Choice {
  /** What to show the user */
  name: string;
  /** What to return as the users answer, if chosen. (If not provided, this property is set to the name string) */
  value?: any;
  /** Makes this a non-selectable item in the list. The arrow keys will skip over this item and it's rendered in grey text. Useful for heading a sub-section of the list */
  disabled?: boolean;
}

type SelectChoice = Choice;

type SelectChoices = Array<SelectChoice | string | null>;

interface CheckboxChoice extends Choice {
  /** Whether this item should be preselected */
  checked?: boolean;
}

type CheckboxChoices = Array<CheckboxChoice | string | null>;

interface BaseOptions {
  /**
   * A function that will be called to validate the user's answer. If validation doesn't pass, a red message will be shown until the user corrects their answer
   * @param answer The answer the user enters
   */
  validate?(answer: string): boolean | string | Promise<boolean | string>;
}

interface Options extends BaseOptions {
  /** Sets a default answer for the question – used if the user simply presses return with no other interaction */
  default?: string;
}

type CheckboxOptions = BaseOptions;

interface ConfirmOptions extends BaseOptions {
  default?: boolean;
}
