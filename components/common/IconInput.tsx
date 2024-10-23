import { User } from 'lucide-react';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select';

interface IconInputProps {
  className?: string;
  placeholder?: string;
  type?: 'text' | 'select' | 'textarea'; // Add support for 'select' and 'textarea'
  inputType?: 'text' | 'email' | 'password' | 'number';
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  icon?: React.ReactNode;
  iconClassName?: string;
  iconPosition?: 'left' | 'right';
  size?: number;
  error?: string;
  success?: string;
  loading?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  name?: string;
  id?: string;
  pattern?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  multiple?: boolean;
  readOnly?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: 'off' | 'on';
  options?: string[]; // For select type options
  optionTitle?: string;
}

const IconInput: React.FC<IconInputProps> = ({
  className,
  placeholder,
  type = 'text',
  inputType = "text",
  disabled,
  value,
  onChange,
  onValueChange,
  onBlur,
  onFocus,
  icon = <User size={16} />,
  iconClassName,
  iconPosition = 'left',
  size = 16,
  error,
  success,
  loading,
  autoComplete,
  autoFocus,
  name,
  id,
  pattern,
  required,
  minLength,
  maxLength,
  min,
  max,
  step,
  multiple,
  readOnly,
  autoCapitalize,
  autoCorrect,
  options, // For select options
  optionTitle,
}) => {
  return (
    <div className={`relative w-full ${className}`}>
      {/* Render Icon based on position */}
      {icon && iconPosition === 'left' && (
        <div
          className={`w-[32px] h-[32px] flex justify-center items-center text-[#969696] border bg-white dark:bg-[#232323] rounded-[8px] absolute left-[8px] top-[-18px] ${iconClassName}`}
        >
          {React.cloneElement(icon as React.ReactElement, { size })}
        </div>
      )}

      {icon && iconPosition === 'right' && (
        <div
          className={`w-[32px] h-[32px] flex justify-center items-center text-[#969696] border bg-white dark:bg-[#232323] rounded-[8px] absolute right-[8px] top-[-18px] ${iconClassName}`}
        >
          {React.cloneElement(icon as React.ReactElement, { size })}
        </div>
      )}

      {/* Render Input, Select, or Textarea based on type */}
      {type === 'text' && (
        <Input
          type={inputType}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          name={name}
          id={id}
          pattern={pattern}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
          multiple={multiple}
          readOnly={readOnly}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          className={`w-full min-h-[56px] px-[24px] placeholder:font-medium rounded-[12px] border-[#0000001f] dark:border-[#ffffff1f] bg-[#f7f7f7] dark:bg-[#1A1A1A] focus-visible:ring-[#19cf31] dark:focus-visible:ring-[#91FF00] ${className}`}
        />
      )}

      {type === 'select' && options && (

        <Select
          disabled={disabled}
          value={value}
          onValueChange={onValueChange}
          name={name}
          required={required}
        >
          <SelectTrigger className={`w-full h-[56px] px-[24px] placeholder:font-medium rounded-[12px] border-[#0000001f] dark:border-[#ffffff1f] bg-[#f7f7f7] dark:bg-[#1A1A1A] focus:ring-[#19cf31] dark:focus:ring-[#91FF00] ${className}`}
          >
            <SelectValue placeholder={placeholder} className='placeholder:font-medium placeholder:opacity-65'/>
          </SelectTrigger>
          <SelectContent
          className='dark:bg-[#1A1A1A]'
          >
            <SelectGroup>
              <SelectLabel>{optionTitle}</SelectLabel>

              {options.map((option, index) => (
                <SelectItem value={option} key={index}>{option}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

      )}

      {type === 'textarea' && (
        <textarea
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          name={name}
          id={id}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          readOnly={readOnly}
          className={`w-full min-h-[120px] px-[24px] py-[18px] placeholder:font-medium border rounded-[12px] bg-[#f7f7f7] dark:bg-[#1A1A1A] focus-visible:ring-[#19cf31] dark:focus-visible:ring-[#91FF00] ${className}`}
        />
      )}

      {/* Error & Success Feedback */}
      {error && <p className="text-red-500 mt-1 text-sm">{error}</p>}
      {success && <p className="text-green-500 mt-1 text-sm">{success}</p>}
    </div>
  );
};

export default IconInput;


