'use client';

import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface ColorPickerInputProps {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}

export function ColorPickerInput({ id, name, label, defaultValue = '#3b82f6', placeholder }: ColorPickerInputProps) {
  const [color, setColor] = useState(defaultValue);

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <Input 
          id={id} 
          name={name} 
          type="color" 
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-20 p-1"
        />
        <Input 
          type="text" 
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
      </div>
    </div>
  );
}
