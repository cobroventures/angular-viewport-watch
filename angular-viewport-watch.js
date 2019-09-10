"use strict";

(function() {
    function viewportWatch(scrollMonitor, $timeout, $state) {
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

                scope.$on('app.tab.change', function($event, changeParams){
                  // When the app tab changes, update the listeners. This allows
                  // us to listen for the viewport (enter and exit) events for the relevant elements.
                  // This tab change is needed because:
                  // 1. Say we are in tab A, and 5 elements have their watches enabled and 4 do not.
                  // 2. Switch to tab B.
                  // 3. While user is in tab B, there is a change so say the 5 elements above get deleted
                  // 4. Since we are going to ignore the events in tab A, watches are the 4 elements that will be
                  // in the viewport.
                  // 5. This to tab A. At this point we will reattach the listeners to the 4 elements that
                  // are in tab A.
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
        };
    }
    viewportWatch.$inject = [ "scrollMonitor", "$timeout", "$state" ];
    angular.module("angularViewportWatch", []).directive("viewportWatch", viewportWatch).value("scrollMonitor", window.scrollMonitor);
})();