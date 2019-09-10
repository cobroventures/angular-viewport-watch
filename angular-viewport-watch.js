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
                function toggleWatchers(scope, enable) {
                    // After the addition of sticky states, we want to ignore toggling the
                    // watchers when these elements are not being displayed.
                    if (attr.viewportWatch && !$state.includes(attr.viewportWatch)) {
                      // This should not happen since we have already stopped the
                      // listeners, but handle it for safety.
                      return;
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

                // This function updates the listeners to on or off based on whether
                // this the currently active base state
                function updateListeners() {
                  if (!attr.viewportWatch || $state.includes(attr.viewportWatch)) {
                    elementWatcher.enterViewport(enableDigest);
                    elementWatcher.exitViewport(disableDigest);
                  } else {
                    elementWatcher.off('enterViewport', enableDigest);
                    elementWatcher.off('exitViewport', enableDigest);
                  }
                }

                scope.$on('app.tab.change', function(){
                  // When the app tab changes, update the listeners. This allows
                  // us to listen for the viewport for the relevant cards
                  updateListeners();
                });

                if (!elementWatcher.isInViewport) {
                    scope.$evalAsync(disableDigest);
                    debouncedViewportUpdate();
                }

                updateListeners();

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