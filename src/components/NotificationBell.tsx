diff --git a/src/components/NotificationBell.tsx b/src/components/NotificationBell.tsx
index 85c8548..85c8548 100644
--- a/src/components/NotificationBell.tsx
+++ b/src/components/NotificationBell.tsx
@@
   useEffect(() => {
     load();
     if (!userId) return;
     const ch = supabase
       .channel(`notifs-${userId}`)
       .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
           (payload) => {
             const n = payload.new as Notif;
             const urgent = n.kind === "auto_handoff_ready";
             if (urgent) {
               try { playChime(); } catch { /* noop */ }
               toast.warning(n.title, { description: n.body ?? undefined, duration: 8000 });
             } else {
               toast(n.title, { description: n.body ?? undefined });
             }
-            load();
+            // Re-load notifications when new arrive. Wrap in try/catch so realtime callback does not throw.
+            try { load(); } catch (err) { console.error('Failed to reload notifications', err); }
           })
       .subscribe();
     return () => { supabase.removeChannel(ch); };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [userId]);
