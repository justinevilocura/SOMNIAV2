import axios from "axios";
import { toast } from "react-toastify";

const GOOGLE_WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ||
  "1087911574541-igmmhfckvfr41vpk9uertjea4g10qn9v.apps.googleusercontent.com";

/**
 * Triggers Google OAuth popup via Google Identity Services and exchanges the
 * access token with the SOMNiA backend.
 */
export const triggerGoogleAuth = ({
  backendUrl,
  checkAuthAndGetUserData,
  navigate,
  setIsGoogleLoading,
  successMessage = "Google sign in successful!",
}) => {
  if (!window.google?.accounts?.oauth2) {
    toast.error("Google Sign-In is still loading. Please try again in a moment.");
    return;
  }

  try {
    setIsGoogleLoading(true);

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: "email profile",
      callback: async (tokenResponse) => {
        if (tokenResponse.error || !tokenResponse.access_token) {
          setIsGoogleLoading(false);
          if (tokenResponse.error !== "popup_closed_by_user") {
            toast.error("Google authentication failed.");
          }
          return;
        }

        try {
          const { data } = await axios.post(
            `${backendUrl}/api/auth/google`,
            { accessToken: tokenResponse.access_token },
            { withCredentials: true }
          );

          if (data.success && data.token) {
            localStorage.setItem("token", data.token);
            sessionStorage.removeItem("token");
            axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
            await checkAuthAndGetUserData();
            toast.success(successMessage);
            navigate("/dashboard", { replace: true });
          } else {
            toast.error(data.message || "Google authentication failed.");
          }
        } catch (error) {
          console.error("Google auth error:", error);
          toast.error(error.response?.data?.message || "Google authentication failed.");
        } finally {
          setIsGoogleLoading(false);
        }
      },
      error_callback: () => {
        setIsGoogleLoading(false);
      },
    });

    tokenClient.requestAccessToken();
  } catch (err) {
    console.error("Google OAuth init error:", err);
    setIsGoogleLoading(false);
    toast.error("Could not start Google Sign-In.");
  }
};
