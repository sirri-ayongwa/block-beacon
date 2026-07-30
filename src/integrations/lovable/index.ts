type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple" | "microsoft" | "lovable", _opts?: SignInOptions) => ({
      error: new Error("Lovable OAuth has been replaced by Firebase Authentication."),
      redirected: false,
    }),
  },
};
