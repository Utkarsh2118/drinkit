import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Zap,
  CheckCircle2,
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

export const CustomerLoginView: React.FC = () => {
  const { user, sendCustomerOtp, verifyCustomerOtp, completeCustomerProfile } = useAuth();
  const { navigate, getRedirectUrl } = useRouter();

  // Authentication Flow States: 'phone' -> 'otp' -> 'profile' (new customer only)
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // OTP State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);

  // Profile Completion State (New Customer)
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Shared Loading & Error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // If customer is already authenticated, redirect to intended destination
  useEffect(() => {
    if (user && !isLoading) {
      navigate(getRedirectUrl('/'));
    }
  }, [user, isLoading, navigate, getRedirectUrl]);

  // Countdown timer effect for OTP resend
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

  // Validation: Indian 10-digit mobile starting with 6, 7, 8, or 9
  const isPhoneValid = phoneNumber.length === 10 && /^[6-9]\d{9}$/.test(phoneNumber);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digit characters and trim leading zeros or 91 country code if pasted
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

      // Focus first input box
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

    // Auto-advance focus to next input
    if (cleaned && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    // Auto-submit after all 6 digits are typed
    if (cleaned && index === 5) {
      const allFilled = updated.every(d => d !== '');
      if (allFilled) {
        handleVerifyOtp(updated.join(''));
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Move focus backward
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
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
    if (code.length !== 6 || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await verifyCustomerOtp(phoneNumber, code);
      if (result.isNewUser) {
        // Transition to Profile Completion for new user
        setStep('profile');
      } else {
        // Existing user authenticated: return to intended destination or home
        const destination = getRedirectUrl('/');
        navigate(destination);
      }
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
      // Reset inputs on failure and refocus first box
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
      setNameError('Please enter your full name (minimum 2 characters)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setNameError(null);

    try {
      await completeCustomerProfile(phoneNumber, trimmedName, email.trim() || undefined);
      // Profile created & token signed: redirect to intended destination
      const destination = getRedirectUrl('/');
      navigate(destination);
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

  // Testing helpers for evaluators
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
    <div className="min-h-[82vh] flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      {/* Return to store button */}
      <div className="w-full max-w-[420px] mb-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors focus:outline-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to DrinkIt store</span>
        </button>
      </div>

      {/* Centered Modern Light-Theme Authentication Card */}
      <div className="w-full max-w-[420px] bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
        {/* Subtle Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
              <Zap className="w-4 h-4 fill-white stroke-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              Drink<span className="text-emerald-600">It</span>
            </span>
          </div>

          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
            {step === 'phone' && 'Welcome to DrinkIt'}
            {step === 'otp' && 'Verify your mobile number'}
            {step === 'profile' && 'Complete your profile'}
          </h1>

          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {step === 'phone' && 'Enter your mobile number to get drinks delivered in 20-30 mins'}
            {step === 'otp' && (
              <span>
                OTP sent to <strong className="text-slate-800">{formattedPhoneDisplay}</strong>
              </span>
            )}
            {step === 'profile' && 'Just enter your name to finalize your DrinkIt account'}
          </p>
        </div>

        {/* Professional Error Alert State */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: MOBILE NUMBER SCREEN                                   */}
        {/* ============================================================== */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label
                htmlFor="customer-phone-input"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Enter your mobile number
              </label>

              <div
                className={`flex items-center rounded-2xl border-2 bg-slate-50 transition-all overflow-hidden ${
                  phoneError
                    ? 'border-rose-300 focus-within:border-rose-500 bg-rose-50/20'
                    : 'border-slate-200 focus-within:border-emerald-600 focus-within:bg-white'
                }`}
              >
                <div className="px-3.5 py-3.5 bg-slate-100/90 border-r border-slate-200 text-slate-800 font-extrabold text-sm flex items-center gap-1.5 select-none shrink-0">
                  <span className="text-base leading-none">🇮🇳</span>
                  <span>+91</span>
                </div>

                <input
                  id="customer-phone-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="Enter 10-digit number"
                  maxLength={10}
                  autoFocus
                  disabled={isLoading}
                  className="flex-1 px-3.5 py-3.5 text-base font-extrabold text-slate-900 bg-transparent placeholder:text-slate-400 placeholder:font-normal focus:outline-none tracking-wider min-w-0"
                />
              </div>

              {phoneError && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1.5 pl-1">
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

            {/* Dev / Reviewer quick helper */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={autofillDemoCustomer}
                  className="w-full py-2 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-800 text-[11px] font-bold transition-colors text-center"
                >
                  ⚡ Fast Test: Fill Demo Mobile (+91 98765 43213)
                </button>
              </div>
            )}

            {/* Terms and Privacy policy notice */}
            <div className="pt-2 text-[11px] text-slate-400 text-center leading-relaxed">
              By continuing, you agree to DrinkIt&apos;s{' '}
              <span className="text-slate-600 font-semibold underline underline-offset-2">
                Terms of Service
              </span>{' '}
              &{' '}
              <span className="text-slate-600 font-semibold underline underline-offset-2">
                Privacy Policy
              </span>
              .<br />
              <span className="text-[10px] text-slate-400">
                You must be 21+ years of age to order alcohol beverages.
              </span>
            </div>
          </form>
        )}

        {/* ============================================================== */}
        {/* STEP 2: OTP VERIFICATION SCREEN                                */}
        {/* ============================================================== */}
        {step === 'otp' && (
          <div className="space-y-4">
            {/* Dev OTP Helper Badge */}
            {process.env.NODE_ENV !== 'production' && devOtp && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                <span className="font-bold">
                  Dev OTP: <span className="underline font-black tracking-widest">{devOtp}</span>
                </span>
                <button
                  type="button"
                  onClick={autofillDevOtp}
                  className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-[10px] hover:bg-emerald-700 transition-colors"
                >
                  Auto-Fill
                </button>
              </div>
            )}

            {/* 6-digit OTP Input Boxes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 text-center">
                Enter 6-digit verification code
              </label>

              <div
                className="flex items-center justify-between gap-1.5 sm:gap-2 py-1"
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
                    aria-label={`Digit ${i + 1} of verification code`}
                    onChange={e => handleOtpDigitChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={isLoading}
                    className="w-11 h-13 sm:w-12 sm:h-14 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:bg-emerald-50/20 text-center text-xl font-extrabold text-slate-900 bg-slate-50 focus:outline-none transition-all shadow-2xs disabled:bg-slate-100"
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
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

            {/* Resend OTP & Change Number Controls */}
            <div className="pt-2 flex flex-col gap-2.5 text-xs text-center border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Didn&apos;t receive the OTP?</span>
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="font-extrabold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <span className="text-slate-400 font-bold">
                    Resend in <span className="font-mono">{countdown}s</span>
                  </span>
                )}
              </div>

              <div className="text-left">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change mobile number</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: PROFILE COMPLETION (NEW CUSTOMER ONLY)                 */}
        {/* ============================================================== */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div>
              <label htmlFor="customer-name" className="block text-xs font-bold text-slate-700 mb-1">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="customer-name"
                type="text"
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value);
                  setNameError(null);
                  setErrorMessage(null);
                }}
                placeholder="Enter your name"
                required
                autoFocus
                disabled={isLoading}
                className={`w-full px-3.5 py-3 rounded-2xl border-2 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all ${
                  nameError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-600'
                }`}
              />
              {nameError && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1 pl-1">
                  {nameError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="customer-email" className="block text-xs font-bold text-slate-700 mb-1">
                Email <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="customer-email"
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Enter your email"
                disabled={isLoading}
                className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !fullName.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Setting up your account...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
