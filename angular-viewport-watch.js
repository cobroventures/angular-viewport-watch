"use strict";

(function() {
    function viewportWatch(scrollMonitor, $timeout) {
        var viewportUpdateTimeout;
        function debouncedViewportUpdate() {
            $timeout.cancel(viewportUpdateTimeout);
            viewportUpdateTimeout = $timeout(function() {
                scrollMonitor.update();
            }, 10);
        }
        return {
            restrict: "AE",
            controller: ['$scope', function($scope){
              // Listen to the card layout changes and recompute
              // the viewport when there are changes
              // so that the appropriate items can be
              // watched
              $scope.$on('UpdateWatchedElements', debouncedViewportUpdate);
            }],
            link: function(scope, element, attr) {
              // This directive is typically used with ng-repeat. So there are possibly hundreds or
              // thousands of directives being created. We do not want to perform the expensive scroll
              // monitor calculations in the same event loop. So delay this by one tick and a
              // moderate run time improvement is seen for ~1000 directives and a more significant
              // improvement is run time is seen when ~5000 directives are being created.
              // This does not affect any other behavior of the viewport watch. As before, the watches
              // are first added, and then the directive removes some of the watches. So the timeout
              // has no impact in terms of the watches.
              $timeout(initViewportWatch, 0, false);

              function initViewportWatch(){
                var elementWatcher = scrollMonitor.create(element, scope.$eval(attr.viewportWatch || "0"));
                function watchDuringDisable() {
                    this.$$watchersBackup = this.$$watchersBackup || [];
                    this.$$watchers = this.$$watchersBackup;
                    var unwatch = this.constructor.prototype.$watch.apply(this, arguments);
                    this.$$watchers = null;
                    return unwatch;
                }
                function toggleWatchers(scope, enable, performViewportCheck) {

                    if (performViewportCheck && enable) {
                      // If the performViewportCheck is true, make sure that the element is in
                      // viewport before proceeding. This happens in, for instance, tab change
                      // in the app.
                      if (!elementWatcher.isInViewport) {
                        return;
                      }
                    }

                    var digest, current, next = scope;
                    do {
                        current = next;
                        if (enable) {
                            if (current.hasOwnProperty("$$watchersBackup")) {
                                current.$$watchers = current.$$watchersBackup;
                                delete current.$$watchersBackup;
                                delete current.$watch;
                                digest = !scope.$root.$$phase;
                            }
                        } else {
                            if (!current.hasOwnProperty("$$watchersBackup")) {
                                current.$$watchersBackup = current.$$watchers;
                                current.$$watchers = null;
                                current.$watch = watchDuringDisable;
                            }
                        }
                        next = current.$$childHead;
                        while (!next && current !== scope) {
                            if (current.$$nextSibling) {
                                next = current.$$nextSibling;
                            } else {
                                current = current.$parent;
                            }
                        }
                    } while (next);
                    if (digest) {
                        scope.$digest();
                    }
                }
                function disableDigest() {
                    toggleWatchers(scope, false);
                }
                function enableDigest() {
                    toggleWatchers(scope, true);
                }

                if (!elementWatcher.isInViewport) {
                    scope.$evalAsync(disableDigest);
                    debouncedViewportUpdate();
                }

                /**
                 * @scope
                 * @function updateListeners
                 *
                 * @description This function updates the listeners to on or off based on app tab change.
                 *
                 * @param {object} changeParams - supported options are
                 * enableWatchers - If true, enable the watchers if the element is in viewport. Also bind
                 * the event handlers for enter and exit viewport
                 * If false, disable watchers and unbind the event handlers
                 *
                 */
                function updateListeners(changeParams) {
                  if (changeParams.enableWatchers) {
                    // Start listening for enter and exit viewport
                    elementWatcher.enterViewport(enableDigest);
                    elementWatcher.exitViewport(disableDigest);
                  }  else {
                    // This will stop listnening for the enter and exit viewport events.
                    elementWatcher.off('enterViewport', enableDigest);
                    elementWatcher.off('exitViewport', disableDigest);
                  }

                  // Enable or disable watches on these element and all its
                  // children
                  toggleWatchers(scope, changeParams.enableWatchers, true);
                }

                // Start listening for enter and exit viewport
                elementWatcher.enterViewport(enableDigest);
                elementWatcher.exitViewport(disableDigest);

                scope.$on('toggleMonitoringAndWatches', function($event, changeParams){
                  // When the request for toggleMonitoringAndWatches comes update the listeners. This allows
                  // us to listen for the viewport (enter and exit) events for the relevant elements.
                  // Since we stopped listening for the events, we need to listen for these events now (or vice-versa)
                  updateListeners(changeParams);
                });

                scope.$on("toggleWatchers", function(event, enable) {
                    toggleWatchers(scope, enable);
                });
                scope.$on("$destroy", function() {
                    elementWatcher.destroy();
                    debouncedViewportUpdate();
                });
              }
            }
        };
    }
    viewportWatch.$inject = [ "scrollMonitor", "$timeout" ];
    angular.module("angularViewportWatch", []).directive("viewportWatch", viewportWatch).value("scrollMonitor", window.scrollMonitor);
})();
