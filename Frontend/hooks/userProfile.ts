import { useState } from 'react';

export const useProfile = () => {
  const [form, setForm] = useState({
    fullName: 'Nguyen Van A',
    username: 'nguyenvana123',
    email: 'vana@gmail.com',
    phone: '0392223332',
    password: '',
    confirmPassword: '',
    role: 'Caregiver',
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  return {
    form,
    setForm,
    showPass,
    setShowPass,
    showConfirm,
    setShowConfirm,
    activeTab,
    setActiveTab,
  };
};