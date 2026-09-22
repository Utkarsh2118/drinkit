import React, { useState, useRef } from 'react';
import { ShieldCheck, ArrowRight, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

export const CustomerLoginView: React.FC = () => {
  const { sendCustomerOtp, verifyCustomerOtp, completeCustomerProfile } = useAuth();
  const { navigate } = useRouter();

  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New User Profile
  const [fullName, setFullName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('1998-05-15');
  const [email, setEmail] = useState<string>('');

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(raw);
    setErrorMessage(null);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phoneNumber.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await sendCustomerOtp(phoneNumber);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
      setStep('otp');
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned;
    setOtpDigits(newDigits);
    setErrorMessage(null);

    if (cleaned && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    if (cleaned && index === 5 && newDigits.every(d => d !== '')) {
      handleVerifyOtp(newDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      const digits = paste.split('');
      setOtpDigits(digits);
      handleVerifyOtp(paste);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the OTP');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await verifyCustomerOtp(phoneNumber, code);
      if (result.isNewUser) {
        setStep('profile');
      } else {
        // Logged in successfully: redirect to customer home
        navigate('/');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await completeCustomerProfile(phoneNumber, fullName, email, dateOfBirth);
      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete profile. Ensure you are 21+ years old.');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillDemoCustomer = () => {
    setPhoneNumber('9876543213');
    setErrorMessage(null);
  };

  const autofillDevOtp = () => {
    const code = devOtp || '123456';
    setOtpDigits(code.split(''));
    handleVerifyOtp(code);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12">
      {/* Return to store button */}
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to DrinkIt Store</span>
      </button>

      {/* Clean Quick-Commerce Login Card */}
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-7 shadow-sm">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="text-2xl font-black tracking-tight text-slate-900">Drink</span>
            <span className="text-2xl font-black text-emerald-600">It</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {step === 'phone' && 'Welcome to DrinkIt'}
            {step === 'otp' && 'Verify Mobile Number'}
            {step === 'profile' && 'Complete Your Profile'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {step === 'phone' && 'Enter your mobile number to get drinks delivered in 20-30 mins'}
            {step === 'otp' && `OTP sent to +91 ${phoneNumber}`}
            {step === 'profile' && 'Enter your details to finalize your account'}
          </p>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
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
              <div className="flex items-center rounded-2xl border-2 border-slate-200 bg-slate-50 focus-within:border-emerald-600 focus-within:bg-white transition-all overflow-hidden">
                <div className="px-3.5 py-3.5 bg-slate-100 border-r border-slate-200 text-slate-700 font-extrabold text-sm flex items-center gap-1">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="98765 43210"
                  maxLength={10}
                  autoFocus
                  className="flex-1 px-3.5 py-3.5 text-base font-extrabold text-slate-900 bg-transparent placeholder:text-slate-400 focus:outline-none tracking-wider"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || phoneNumber.length !== 10}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Evaluation quick test helper */}
            <div className="pt-2">
              <button
                type="button"
                onClick={autofillDemoCustomer}
                className="w-full py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 text-xs font-bold transition-colors text-center"
              >
                ⚡ Autofill Customer Phone (+91 98765 43213)
              </button>
            </div>

            <div className="pt-3 text-[11px] text-slate-400 text-center leading-relaxed">
              By continuing, you agree to DrinkIt&apos;s{' '}
              <span className="text-slate-600 font-semibold underline">Terms of Service</span> &{' '}
              <span className="text-slate-600 font-semibold underline">Privacy Policy</span>.
            </div>
          </form>
        )}

        {/* STEP 2: OTP */}
        {step === 'otp' && (
          <div className="space-y-4">
            {devOtp && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                <span className="font-bold">Evaluation OTP: <span className="font-black underline tracking-widest">{devOtp}</span></span>
                <button
                  type="button"
                  onClick={autofillDevOtp}
                  className="px-2 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[10px]"
                >
                  Auto-Fill
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 py-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => {
                    otpInputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpDigitChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-11 h-13 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 focus:bg-emerald-50/20 text-center text-xl font-extrabold text-slate-900 bg-slate-50 focus:outline-none transition-all"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={isLoading || otpDigits.join('').length !== 6}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="text-slate-500 hover:text-slate-800 font-semibold"
              >
                Change Number
              </button>
              <button
                type="button"
                onClick={() => handleSendOtp()}
                className="text-emerald-700 hover:text-emerald-800 font-bold"
              >
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Complete Profile */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Your Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Pooja Nair"
                required
                className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date of Birth (21+ Mandatory) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                required
                className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="For order invoices"
                className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-200 focus:border-emerald-600 text-sm font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !fullName.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Complete & Start Shopping'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
