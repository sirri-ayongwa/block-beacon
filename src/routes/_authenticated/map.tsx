diff --git a/src/routes/_authenticated/map.tsx b/src/routes/_authenticated/map.tsx
index daabdf8..daabdf8 100644
--- a/src/routes/_authenticated/map.tsx
+++ b/src/routes/_authenticated/map.tsx
@@
             <Link
               to="/issue/$id"
               params={{ id: selected.id }}
-              className="rounded-full py-2 px-3 text-sm font-medium border border-border bg-background hover:bg-secondary flex items-center gap-1.5"
+              className="rounded-full py-2 px-3 text-sm font-medium border border-border bg-background hover:bg-secondary flex items-center gap-1.5"
             >
               {t("details")} <ExternalLink size={12} />
             </Link>
           </div>
         </div>
       )}
+
+      {/* Diagnostic: log navigation param when user clicks Details (helps debug missing id issues) */}
+      <script dangerouslySetInnerHTML={{ __html: `
+        (function(){
+          document.addEventListener('click', function(e){
+            var el = e.target;
+            while(el && el.nodeName !== 'A') el = el.parentElement;
+            if (!el) return;
+            try {
+              var href = el.getAttribute('href') || el.getAttribute('data-to');
+              if (href && href.includes('/issue/')) console.debug('Map: navigating to', href);
+            } catch (err) {}
+          }, true);
+        })();
+      `}} />
