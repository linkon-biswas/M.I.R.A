import React, { useEffect, useState } from 'react';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Facebook,
  Linkedin,
  Instagram,
  Twitter
} from 'lucide-react';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SocialAccountsPage() {
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState('');

  const checkAuth = async (isManualTrigger = false) => {
    if (isManualTrigger) {
      setVerifying(true);
    } else {
      setLoading(true);
    }

    setError(null);
    setFeedback('');

    try {
      const data = await apiService.verifyAuth();

      // Backend returns `valid: true`
      setAuthStatus(data);

      if (isManualTrigger) {
        setFeedback('Connection re-verified successfully!');
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Failed to verify Zernio API authentication status'
      );
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  useEffect(() => {
    checkAuth(false);
  }, []);

  const getPlatformIcon = (platform) => {
    switch ((platform || '').toLowerCase()) {
      case 'facebook':
        return <Facebook className="w-5 h-5 text-blue-500" />;

      case 'linkedin':
        return <Linkedin className="w-5 h-5 text-sky-500" />;

      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-500" />;

      case 'twitter':
        return <Twitter className="w-5 h-5 text-slate-200" />;

      default:
        return <Share2 className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Page Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400" />
            Social Channels & Credentials
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Real-time status of Zernio API provider authentication and target accounts.
          </p>
        </div>

        <button
          onClick={() => checkAuth(true)}
          disabled={verifying || loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 focus:ring-2 focus:ring-blue-400"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''
              }`}
          />

          <span>
            {verifying ? 'Verifying...' : 'Re-Verify Connection'}
          </span>
        </button>
      </div>

      {/* Manual verification feedback message */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {feedback}
        </div>
      )}

      {/* Main Authentication Status Card */}
      {loading ? (
        <LoadingSpinner text="Verifying Zernio API credentials..." />
      ) : error ? (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />

          <div>
            <p className="font-semibold text-rose-200">
              Zernio Authentication Failed
            </p>

            <p className="text-xs text-rose-300/90 mt-1">
              {error}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Authentication Status */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              <div className="flex items-center gap-3">

                <div
                  className={`p-3 rounded-xl ${authStatus?.valid
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                    }`}
                >
                  <ShieldCheck className="w-6 h-6" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {authStatus?.valid
                      ? 'Zernio API Connection Active'
                      : 'Zernio Authentication Issue'}
                  </h3>

                  <p className="text-xs text-slate-400">
                    {authStatus?.message ||
                      'Zernio publishing engine ready'}
                  </p>
                </div>

              </div>

              {/* Authentication Badge */}
              <div className="flex items-center gap-2">
                {authStatus?.valid ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Authenticated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Connection Error
                  </span>
                )}
              </div>

            </div>
          </div>

          {/* Connected Accounts List */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">

            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Connected Target Channels
            </h3>

            {authStatus?.accounts &&
              authStatus.accounts.length > 0 ? (

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {authStatus.accounts.map((acc, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                  >

                    <div className="flex items-center gap-3">

                      <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                        {getPlatformIcon(acc.platform)}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-200 capitalize">
                          {acc.platform} Account
                        </h4>

                        <p className="text-xs text-slate-400 font-mono">
                          ID: {acc.accountId}
                        </p>
                      </div>

                    </div>

                    <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
                      Active
                    </span>

                  </div>
                ))}

              </div>

            ) : (

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Default Facebook account fallback */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                      <Facebook className="w-5 h-5 text-blue-500" />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-200">
                        Facebook Page
                      </h4>

                      <p className="text-xs text-slate-400 font-mono">
                        ID: 6ab3ef6b8d284ffb21357563
                      </p>
                    </div>

                  </div>

                  <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
                    Ready
                  </span>

                </div>

              </div>

            )}

          </div>
        </div>
      )}
    </div>
  );
}



// import React, { useEffect, useState } from 'react';
// import { 
//   Share2, 
//   CheckCircle2, 
//   AlertCircle, 
//   RefreshCw, 
//   ShieldCheck, 
//   Facebook, 
//   Linkedin, 
//   Instagram, 
//   Twitter 
// } from 'lucide-react';
// import { apiService } from '../services/api';
// import LoadingSpinner from '../components/LoadingSpinner';

// export default function SocialAccountsPage() {
//   const [authStatus, setAuthStatus] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [verifying, setVerifying] = useState(false);
//   const [error, setError] = useState(null);
//   const [feedback, setFeedback] = useState('');

//   const checkAuth = async (isManualTrigger = false) => {
//     if (isManualTrigger) {
//       setVerifying(true);
//     } else {
//       setLoading(true);
//     }
//     setError(null);
//     setFeedback('');

//     try {
//       const data = await apiService.verifyAuth();
//       setAuthStatus(data);
//       if (isManualTrigger) {
//         setFeedback('Connection re-verified successfully!');
//       }
//     } catch (err) {
//       setError(err.response?.data?.error || 'Failed to verify Zernio API authentication status');
//     } finally {
//       setLoading(false);
//       setVerifying(false);
//     }
//   };

//   useEffect(() => {
//     checkAuth(false);
//   }, []);

//   const getPlatformIcon = (platform) => {
//     switch ((platform || '').toLowerCase()) {
//       case 'facebook':
//         return <Facebook className="w-5 h-5 text-blue-500" />;
//       case 'linkedin':
//         return <Linkedin className="w-5 h-5 text-sky-500" />;
//       case 'instagram':
//         return <Instagram className="w-5 h-5 text-pink-500" />;
//       case 'twitter':
//         return <Twitter className="w-5 h-5 text-slate-200" />;
//       default:
//         return <Share2 className="w-5 h-5 text-blue-400" />;
//     }
//   };

//   return (
//     <div className="space-y-6 max-w-4xl mx-auto">
//       {/* Page Header */}
//       <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//         <div>
//           <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
//             <Share2 className="w-5 h-5 text-blue-400" />
//             Social Channels & Credentials
//           </h1>
//           <p className="text-xs text-slate-400 mt-1">Real-time status of Zernio API provider authentication and target accounts.</p>
//         </div>
//         <button
//           onClick={() => checkAuth(true)}
//           disabled={verifying || loading}
//           className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 focus:ring-2 focus:ring-blue-400"
//         >
//           <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
//           <span>{verifying ? 'Verifying...' : 'Re-Verify Connection'}</span>
//         </button>
//       </div>

//       {/* Manual verification feedback message */}
//       {feedback && (
//         <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
//           <CheckCircle2 className="w-4 h-4 text-emerald-400" />
//           {feedback}
//         </div>
//       )}

//       {/* Main Authentication Status Card */}
//       {loading ? (
//         <LoadingSpinner text="Verifying Zernio API credentials..." />
//       ) : error ? (
//         <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
//           <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
//           <div>
//             <p className="font-semibold text-rose-200">Zernio Authentication Failed</p>
//             <p className="text-xs text-rose-300/90 mt-1">{error}</p>
//           </div>
//         </div>
//       ) : (
//         <div className="space-y-6">
//           <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
//             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//               <div className="flex items-center gap-3">
//                 <div className={`p-3 rounded-xl ${authStatus?.authenticated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
//                   <ShieldCheck className="w-6 h-6" />
//                 </div>
//                 <div>
//                   <h3 className="text-base font-bold text-slate-100">
//                     {authStatus?.authenticated ? 'Zernio API Connection Active' : 'Zernio Authentication Issue'}
//                   </h3>
//                   <p className="text-xs text-slate-400">{authStatus?.message || 'Zernio publishing engine ready'}</p>
//                 </div>
//               </div>

//               <div className="flex items-center gap-2">
//                 {authStatus?.authenticated ? (
//                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
//                     <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated
//                   </span>
//                 ) : (
//                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
//                     <AlertCircle className="w-3.5 h-3.5" /> Connection Error
//                   </span>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Connected Accounts List */}
//           <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
//             <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
//               Connected Target Channels
//             </h3>

//             {authStatus?.accounts && authStatus.accounts.length > 0 ? (
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                 {authStatus.accounts.map((acc, index) => (
//                   <div key={index} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
//                     <div className="flex items-center gap-3">
//                       <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
//                         {getPlatformIcon(acc.platform)}
//                       </div>
//                       <div>
//                         <h4 className="text-sm font-bold text-slate-200 capitalize">{acc.platform} Account</h4>
//                         <p className="text-xs text-slate-400 font-mono">ID: {acc.accountId}</p>
//                       </div>
//                     </div>
//                     <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
//                       Active
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//                 {/* Default Facebook account fallback matching backend test targets */}
//                 <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
//                   <div className="flex items-center gap-3">
//                     <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
//                       <Facebook className="w-5 h-5 text-blue-500" />
//                     </div>
//                     <div>
//                       <h4 className="text-sm font-bold text-slate-200">Facebook Page</h4>
//                       <p className="text-xs text-slate-400 font-mono">ID: 6ab3ef6b8d284ffb21357563</p>
//                     </div>
//                   </div>
//                   <span className="text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
//                     Ready
//                   </span>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
