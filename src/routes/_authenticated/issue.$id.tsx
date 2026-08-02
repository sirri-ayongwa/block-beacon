diff --git a/src/routes/_authenticated/issue.$id.tsx b/src/routes/_authenticated/issue.$id.tsx
index 827a7f8..827a7f8 100644
--- a/src/routes/_authenticated/issue.$id.tsx
+++ b/src/routes/_authenticated/issue.$id.tsx
@@
   if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
   if (!issue) {
     return (
       <div className="min-h-screen grid place-items-center text-center px-6">
         <div>
           <div className="text-lg font-semibold">This report isn't here.</div>
-          <div className="mt-3 flex items-center gap-3 justify-center">
-            <button onClick={() => loadAll()} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Retry</button>
-            <Link to="/map" className="text-sm text-primary underline">Back to the map</Link>
-          </div>
+          <div className="mt-3 flex items-center gap-3 justify-center">
+            <button onClick={() => loadAll()} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Retry</button>
+            <Link to="/map" className="text-sm text-primary underline">Back to the map</Link>
+          </div>
+          {/* Diagnostic info (visible in dev only) */}
+          {process.env.NODE_ENV !== 'production' && (
+            <pre className="mt-3 text-xs text-muted-foreground text-left bg-card/50 border border-border rounded p-3 max-w-xl mx-auto">Requested id: {String(id)}</pre>
+          )}
         </div>
       </div>
     );
   }
