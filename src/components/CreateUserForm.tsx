'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useToast } from '@/components/ToastContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface CreateUserFormProps {
  centerId: string;
  onSuccess: () => void;
}

function generarTokenUnico() {
  return Array.from(crypto.getRandomValues(new Uint8Array(22)))
    .map((x) => ('0' + x.toString(16)).slice(-2))
    .join('');
}

export function CreateUserForm({ centerId, onSuccess }: CreateUserFormProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
  });
  const [errors, setErrors] = useState({
    fullName: '',
  });

  const validate = () => {
    const newErrors = {
      fullName: '',
      email: '',
    };

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'El nombre completo es obligatorio';
    } else if (formData.fullName.trim().length < 3) {
      newErrors.fullName = 'El nombre debe tener al menos 3 caracteres';
    }

  
    setErrors(newErrors);
    return !newErrors.fullName && !newErrors.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      showToast('Por favor, corrige los errores del formulario', 'error');
      return;
    }

    setLoading(true);

    try {
      const token = generarTokenUnico();

      const { data, error } = await supabase.from('users').insert([
        {
          center_id: centerId,
          full_name: formData.fullName.trim(),
          login_token: token,
        },
      ]).select();

      if (error) throw error;

      showToast('Usuario creado exitosamente', 'success');
      setFormData({ fullName: ''});
      setErrors({ fullName: ''});
      onSuccess();
    } catch (error: any) {
      showToast(error.message || 'Error al crear el usuario', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Crear Nuevo Usuario</h2>

      <Input
        label="Nombre Completo *"
        type="text"
        value={formData.fullName}
        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        error={errors.fullName}
        placeholder="Ej: Juan García López"
        required
      />



      <div className="flex gap-4 pt-4">
        <Button type="submit" variant="primary" size="lg" loading={loading} className="flex-1">
          Crear Usuario
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => {
            setFormData({ fullName: ''});
            setErrors({ fullName: ''});
          }}
          disabled={loading}
        >
          Limpiar
        </Button>
      </div>
    </form>
  );
}