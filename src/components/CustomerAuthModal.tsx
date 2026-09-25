import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

function getFriendlyErrorMessage(err: any): string {
  const code = err?.errorCode || '';
  const msg = err?.message || '';

  if (code === 'INVALID_PHONE') {
    return 'Please enter a valid 10-digit Indian mobile number';
  }
  if (code === 'INCORRECT_OTP') {
    return "That OTP doesn't look right. Please try again.";
  }
  if (code === 'EXPIRED_OTP' || code === 'NO_OTP_SESSION') {
    return 'This OTP has expired. Please request a new one.';
  }
  if (code === 'MAX_ATTEMPTS_EXCEEDED' || code === 'OTP_VERIFY_RATE_LIMITED') {
    return 'Too many attempts. Please request a new OTP.';
  }
  if (code === 'OTP_RATE_LIMITED' || code === 'OTP_SEND_RATE_LIMITED') {
    return 'Too many OTP requests. Please try again later.';
  }
  if (code === 'NETWORK_ERROR' || msg.includes('Failed to fetch') || msg.includes('connection')) {
    return 'Something went wrong. Please check your connection and try again.';
  }
  if (err?.status >= 500) {
    return "We couldn't verify your OTP right now. Please try again.";
  }
  return msg || "We couldn't verify your OTP right now. Please try again.";
}

export const CustomerAuthModal: React.FC = () => {
  const {
    isCustomerAuthModalOpen,
    setIsCustomerAuthModalOpen,
    sendCustomerOtp,
    verifyCustomerOtp,
    completeCustomerProfile,
  } = useAuth();
  const { navigate, getRedirectUrl } = useRouter();

  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isCustomerAuthModalOpen) {
      setStep('phone');
      setPhoneNumber('');
      setPhoneError(null);
      setOtpDigits(['', '', '', '', '', '']);
      setErrorMessage(null);
      setDevOtp(null);
    }
  }, [isCustomerAuthModalOpen]);

  // Resend countdown timer
  useEffect(() => {
    let timer: any;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isCustomerAuthModalOpen) return null;

  const isPhoneValid = phoneNumber.length === 10 && /^[6-9]\d{9}$/.test(phoneNumber);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 10 && raw.startsWith('91')) {
      raw = raw.slice(2);
    } else if (raw.length > 10 && raw.startsWith('0')) {
      raw = raw.slice(1);
    }
    const cleanTen = raw.slice(0, 10);
    setPhoneNumber(cleanTen);
    setErrorMessage(null);

    if (cleanTen.length > 0 && !/^[6-9]/.test(cleanTen)) {
      setPhoneError('Mobile number must begin with 6, 7, 8, or 9');
    } else if (cleanTen.length === 10 && !/^[6-9]\d{9}$/.test(cleanTen)) {
      setPhoneError('Please enter a valid 10-digit mobile number');
    } else {
      setPhoneError(null);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isPhoneValid) {
      setPhoneError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setPhoneError(null);

    try {
      const res = await sendCustomerOtp(phoneNumber);
      setDevOtp(res.devOtp || null);
      setStep('otp');
      setCountdown(res.resendCooldownSeconds || 30);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);

      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await sendCustomerOtp(phoneNumber);
      setDevOtp(res.devOtp || null);
      setCountdown(res.resendCooldownSeconds || 30);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleaned;
    setOtpDigits(updated);
    setErrorMessage(null);

    if (cleaned && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (cleaned && index === 5 && updated.every(d => d !== '')) {
      handleVerifyOtp(updated.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;

    const chars = paste.split('');
    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = chars[i] || '';
    }
    setOtpDigits(updated);
    setErrorMessage(null);

    if (paste.length === 6) {
      otpInputsRef.current[5]?.focus();
      handleVerifyOtp(paste);
    } else {
      otpInputsRef.current[Math.min(5, paste.length)]?.focus();
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6 || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await verifyCustomerOtp(phoneNumber, code);
      if (res.isNewUser) {
        setStep('profile');
      } else {
        setIsCustomerAuthModalOpen(false);
        const destination = getRedirectUrl();
        if (destination && destination !== '/') {
          navigate(destination);
        }
      }
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 50);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setNameError('Full name must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setNameError(null);

    try {
      await completeCustomerProfile(phoneNumber, trimmedName, email.trim() || undefined);
      setIsCustomerAuthModalOpen(false);
      const destination = getRedirectUrl();
      if (destination && destination !== '/') {
        navigate(destination);
      }
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const formattedPhoneDisplay =
    phoneNumber.length === 10
      ? `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
      : `+91 ${phoneNumber}`;

  const autofillDemoCustomer = () => {
    setPhoneNumber('9876543213');
    setPhoneError(null);
    setErrorMessage(null);
  };

  const autofillDevOtp = () => {
    const code = devOtp || '123456';
    setOtpDigits(code.split(''));
    setErrorMessage(null);
    handleVerifyOtp(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-scale-up">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
              <Zap className="w-4 h-4 fill-white stroke-white" />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 leading-tight">
                Drink<span className="text-emerald-600">It</span>
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                ⚡ 20-Min Delivery
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsCustomerAuthModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* Header text */}
          <div className="mb-5 text-center">
            <h2 className="text-lg font-extrabold text-slate-900">
              {step === 'phone' && 'Welcome to DrinkIt'}
              {step === 'otp' && 'Verify your mobile number'}
              {step === 'profile' && 'Complete your profile'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {step === 'phone' && 'Enter your mobile number to get drinks delivered fast'}
              {step === 'otp' && `OTP sent to ${formattedPhoneDisplay}`}
              {step === 'profile' && 'Enter your name to start ordering'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Phone */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mobile Number
                </label>
                <div
                  className={`flex items-center rounded-2xl border-2 bg-slate-50 transition-all overflow-hidden ${
                    phoneError
                      ? 'border-rose-300 focus-within:border-rose-500'
                      : 'border-slate-200 focus-within:border-emerald-600 focus-within:bg-white'
                  }`}
                >
                  <div className="px-3.5 py-3.5 bg-slate-100 border-r border-slate-200 text-slate-800 font-extrabold text-sm flex items-center gap-1.5 shrink-0 select-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="Enter 10-digit number"
                    maxLength={10}
                    autoFocus
                    disabled={isLoading}
                    className="flex-1 px-3.5 py-3.5 text-base font-extrabold text-slate-900 bg-transparent placeholder:text-slate-400 focus:outline-none tracking-wider min-w-0"
                  />
                </div>
                {phoneError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1 pl-1">
                    {phoneError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !isPhoneValid}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {process.env.NODE_ENV !== 'production' && (
                <button
                  type="button"
                  onClick={autofillDemoCustomer}
                  className="w-full py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 text-[11px] font-bold transition-colors text-center"
                >
                  ⚡ Fill Demo Number (+91 98765 43213)
                </button>
              )}
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === 'otp' && (
            <div className="space-y-4">
              {process.env.NODE_ENV !== 'production' && devOtp && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                  <span className="font-bold">
                    Dev OTP: <span className="underline font-black tracking-widest">{devOtp}</span>
                  </span>
                  <button
                    type="button"
                    onClick={autofillDevOtp}
                    className="px-2 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[10px]"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <div
                className="flex items-center justify-between gap-1.5 py-1"
                onPaste={handleOtpPaste}
              >
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => {
                      otpInputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpDigitChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={isLoading}
                    className="w-11 h-13 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:bg-emerald-50/20 text-center text-xl font-extrabold text-slate-900 bg-slate-50 focus:outline-none transition-all shadow-2xs"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <span>Verify & Continue</span>
                )}
              </button>

              <div className="pt-2 flex flex-col gap-2 text-xs border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Didn&apos;t receive code?</span>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      Resend OTP
                    </button>
                  ) : (
                    <span className="text-slate-400 font-semibold">
                      Resend in {countdown}s
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setErrorMessage(null);
                  }}
                  className="text-left font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change number</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Profile */}
          {step === 'profile' && (
            <form onSubmit={handleCompleteProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => {
                    setFullName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder="Enter your name"
                  required
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all"
                />
                {nameError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1 pl-1">
                    {nameError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !fullName.trim()}
                className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Continue to Store</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
