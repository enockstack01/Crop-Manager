import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from './Icon';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, spacing } from '../theme/theme';
import { formatDate, parseISODate, toISODate } from '../lib/format';
import { AppText } from './ui';
import { CURRENCIES } from '../lib/currencies';
import { Sheet } from './Sheet';

/* --------------------------------------------------------------- useForm */
export type FormApi<T = Record<string, any>> = {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  set: (name: keyof T, value: any) => void;
  reset: (next?: T) => void;
  bind: (name: keyof T) => { value: any; onChangeValue: (v: any) => void };
};

export function useForm<T extends Record<string, any>>(initial: T): FormApi<T> {
  const [values, setValues] = useState<T>(initial);
  const set = useCallback((name: keyof T, value: any) => setValues((v) => ({ ...v, [name]: value })), []);
  const reset = useCallback((next: T = initial) => setValues(next), [initial]);
  const bind = useCallback(
    (name: keyof T) => ({
      value: values[name] ?? '',
      onChangeValue: (v: any) => set(name, v),
    }),
    [values, set],
  );
  return { values, setValues, set, reset, bind };
}

/* ----------------------------------------------------------------- Field */
export type Option = string | { value: string; label: string };
const optValue = (o: Option) => (typeof o === 'object' ? o.value : o);
const optLabel = (o: Option) => (typeof o === 'object' ? o.label : o);

function Field({
  label,
  required,
  hint,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="label">
          {label}
          {required ? <AppText variant="label" style={{ color: colors.red }}> *</AppText> : null}
        </AppText>
      ) : null}
      {children}
      {hint ? <AppText variant="caption" style={{ color: colors.textLight }}>{hint}</AppText> : null}
    </View>
  );
}

const inputStyle = (colors: any) => ({
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.input,
  borderRadius: radius.md,
  paddingHorizontal: 14,
  paddingVertical: 10,
  minHeight: 42,
  fontSize: 13,
  fontFamily: ff('400'),
  color: colors.text,
});
/** web .form-control:focus — primary border + 3px soft green ring */
const focusRing = (colors: any) => ({ borderColor: colors.primary, boxShadow: '0 0 0 3px rgba(46,125,50,0.12)' as any });

/* ------------------------------------------------------------- TextField */
export function TextField({
  label, required, hint, value, onChangeValue, placeholder, keyboardType, multiline, autoCapitalize, secureTextEntry, editable = true,
  icon, autoComplete, textContentType, returnKeyType, onSubmitEditing,
}: {
  label?: string; required?: boolean; hint?: string;
  value: any; onChangeValue: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
  autoCapitalize?: any; secureTextEntry?: boolean; editable?: boolean;
  /** Icon name shown inside the field on the left */
  icon?: string;
  autoComplete?: any; textContentType?: any; returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isSecret = !!secureTextEntry;

  return (
    <Field label={label} required={required} hint={hint}>
      <View
        style={[
          inputStyle(colors),
          {
            flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: spacing.sm,
            paddingVertical: 0,
          },
          focused ? focusRing(colors) : null,
          !editable ? { opacity: 0.6 } : null,
        ]}
      >
        {icon ? (
          <Icon
            name={icon as any}
            size={14}
            color={focused ? colors.primary : colors.textLight}
            style={multiline ? { marginTop: spacing.md } : null}
          />
        ) : null}
        <TextInput
          value={value == null ? '' : String(value)}
          onChangeText={onChangeValue}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          secureTextEntry={isSecret && hidden}
          editable={editable}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            { flex: 1, fontSize: 13, fontFamily: ff('400'), color: colors.text, paddingVertical: Platform.OS === 'ios' ? 11 : 9 },
            multiline ? { minHeight: 84, textAlignVertical: 'top' } : null,
          ]}
        />
        {isSecret ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={14} color={colors.textLight} />
          </Pressable>
        ) : null}
      </View>
    </Field>
  );
}

export function NumberField(props: Omit<Parameters<typeof TextField>[0], 'keyboardType'>) {
  return <TextField {...props} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} />;
}

export function TextAreaField(props: Parameters<typeof TextField>[0]) {
  return <TextField {...props} multiline />;
}

/* ----------------------------------------------------------- SelectField */
/**
 * An amount with its currency picked right beside it: [USD ▾][ 0.00 ].
 * Every money field in a record shares the record's `currency`.
 */
export function MoneyField({
  label, required, hint, form, name, currencyName = 'currency',
}: {
  label?: string; required?: boolean; hint?: string;
  form: FormApi<any>; name: string; currencyName?: string;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ width: 104 }}>
          <SelectField {...form.bind(currencyName)} options={CURRENCY_CODES} placeholder="" />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField {...form.bind(name)} placeholder="0.00" />
        </View>
      </View>
    </Field>
  );
}
const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function SelectField({
  label, required, hint, value, onChangeValue, options = [], placeholder = 'Select…',
}: {
  label?: string; required?: boolean; hint?: string;
  value: any; onChangeValue: (v: string) => void;
  options: Option[]; placeholder?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => optValue(o) === value);
  const display = current ? optLabel(current) : '';

  return (
    <Field label={label} required={required} hint={hint}>
      <Pressable
        onPress={() => setOpen(true)}
        style={[inputStyle(colors), { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <AppText style={{ fontSize: 13, color: display ? colors.text : colors.placeholder, flex: 1 }} numberOfLines={1}>{display || placeholder}</AppText>
        <Icon name="chevron-down" size={11} color={colors.textLight} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label || 'Select'}>
        {placeholder ? (
          <SelectRow label={placeholder} selected={!value} onPress={() => { onChangeValue(''); setOpen(false); }} />
        ) : null}
        {options.map((o) => (
          <SelectRow
            key={optValue(o)}
            label={optLabel(o)}
            selected={optValue(o) === value}
            onPress={() => { onChangeValue(optValue(o)); setOpen(false); }}
          />
        ))}
      </Sheet>
    </Field>
  );
}

function SelectRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
        backgroundColor: pressed ? colors.bg : 'transparent',
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
      })}
    >
      <AppText weight={selected ? '600' : '400'} style={{ fontSize: 14, color: selected ? colors.primary : colors.text }}>
        {label}
      </AppText>
      {selected ? <Icon name="check" size={13} color={colors.primary} /> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------- DateField */
export function DateField({
  label, required, hint, value, onChangeValue,
}: {
  label?: string; required?: boolean; hint?: string;
  value: any; onChangeValue: (v: string) => void;
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  return (
    <Field label={label} required={required} hint={hint}>
      <Pressable
        onPress={() => setShow(true)}
        style={[inputStyle(colors), { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <AppText style={{ fontSize: 13, color: value ? colors.text : colors.placeholder }}>
          {value ? formatDate(value) : 'mm/dd/yyyy'}
        </AppText>
        <Icon name="calendar" size={13} color={colors.textLight} />
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChangeValue('')} hitSlop={6}>
          <AppText variant="caption" style={{ color: colors.red }}>Clear</AppText>
        </Pressable>
      ) : null}
      {show ? (
        <DateTimePicker
          value={parseISODate(value)}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShow(false);
            if (event.type === 'set' && date) onChangeValue(toISODate(date));
          }}
        />
      ) : null}
    </Field>
  );
}

/* ------------------------------------------------------------- FormRow */
/** On phones every field stacks vertically — `cols` from the web config is ignored. */
export function FormRow({ children }: { children: React.ReactNode; cols?: number }) {
  return <View style={{ gap: spacing.md }}>{children}</View>;
}
