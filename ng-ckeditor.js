// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
// jscs:disable disallowMultipleVarDecl
/*global define, CKEDITOR*/

(function(angular, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['angular', 'ckeditor'], function(angular) {
      return factory(angular);
    });
  } else {
    return factory(angular);
  }
}(angular || null, function(angular) {
  var app = angular.module('ngCkeditor', []);
  var $defer, loaded = false;

  app.run(['$q', '$timeout', '$window', '$document', function($q, $timeout, $window, $document) {
    $defer = $q.defer();

    function checkLoaded() {
      try {
        if (CKEDITOR.status === 'loaded') {
          CKEDITOR.disableAutoInline = true;
          loaded = true;
          $defer.resolve();
        } else {
          checkLoaded();
        }
      } catch(e) {
        $timeout(checkLoaded, 100);
      }
    }

    // Asynchronously load CKEditor
    var scriptTag = $document[0].createElement('script');
    scriptTag.type = 'text/javascript';
    scriptTag.async = true;
    scriptTag.src = '../../' + $window.versionId + 'external/ng-ckeditor/libs/ckeditor/ckeditor.js';
    scriptTag.onreadystatechange = function () {
      if (this.readyState == 'complete') checkLoaded();
    };
    scriptTag.onload = checkLoaded;
    $document[0].getElementsByTagName('body')[0].appendChild(scriptTag);
  }]);

  app.directive('ckeditor', ['$timeout', '$q', function($timeout, $q) {
    'use strict';

    return {
      restrict: 'AC',
      require: ['ngModel', '^?form'],
      scope: {
        onConfigLoad: '=',
        editor: '='
      },
      link: function(scope, element, attrs, ctrls) {
        var ngModel = ctrls[0];
        var form = ctrls[1] || null;
        var EMPTY_HTML = '<p></p>',
            isTextarea = element[0].tagName.toLowerCase() === 'textarea',
            data = [],
            isReady = false;

        if (!isTextarea) {
          element.attr('contenteditable', true);
        }

        var onLoad = function() {
          var options = {
            toolbar: 'full',
            toolbar_full: [ //jshint ignore:line
              {
                name: 'basicstyles',
                items: ['Bold', 'Italic', 'Strike', 'Underline']
              },
              {name: 'paragraph', items: ['BulletedList', 'NumberedList', 'Blockquote']},
              {name: 'editing', items: ['JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock']},
              {name: 'links', items: ['Link', 'Unlink', 'Anchor']},
              {name: 'tools', items: ['SpellChecker', 'Maximize']},
              '/',
              {
                name: 'styles',
                items: ['Format', 'FontSize', 'TextColor', 'PasteText', 'PasteFromWord', 'RemoveFormat']
              },
              {name: 'insert', items: ['Image', 'Table', 'SpecialChar']},
              {name: 'forms', items: ['Outdent', 'Indent']},
              {name: 'clipboard', items: ['Undo', 'Redo']},
              {name: 'document', items: ['PageBreak', 'Source']}
            ],
            disableNativeSpellChecker: false,
            uiColor: '#FAFAFA',
            width: '100%'
          };
          options = angular.extend(options, scope.$parent[attrs.ckeditor]);

          var instance = (isTextarea) ? CKEDITOR.replace(element[0], options) : CKEDITOR.inline(element[0], options),
              configLoaderDef = $q.defer();

          element.bind('$destroy', function() {
            try {
              instance.destroy(
                  false //If the instance is replacing a DOM element, this parameter indicates whether or not to update the element with the instance contents.
              );
            }
            catch (e) {
              // This only happens when a scope destroy is attempted well before ckeditor has loaded and is safe to ignore.
            }
          });
          var setModelData = function(setPristine) {
            var data = instance.getData();
            if (data === '' && !(options && options.useEmptyString)) {
              data = null;
            }
            $timeout(function() { // for key up event
              if (setPristine !== true || data !== ngModel.$viewValue)
                ngModel.$setViewValue(data);

              if (setPristine === true && form)
                form.$setPristine();
            }, 0);
          }, onUpdateModelData = function(setPristine) {
            if (!data.length) {
              return;
            }

            var item = data.pop() || EMPTY_HTML;
            isReady = false;
            instance.setData(item, function() {
              setModelData(setPristine);
              isReady = true;
            });
          };

          //instance.on('pasteState',   setModelData);
          instance.on('change', setModelData);
          instance.on('blur', setModelData);
          //instance.on('key',          setModelData); // for source view

          instance.on('instanceReady', function() {
            scope.$parent.$emit('ckeditor.ready', instance);
            scope.$parent.$apply(function() {
              onUpdateModelData(true);
            });

            instance.document.on('keyup', setModelData);
          });

          instance.on('customConfigLoaded', function() {
            configLoaderDef.resolve();

            if (scope.onConfigLoad) {
              if (scope.editor)
                scope.editor.instance = instance;
              scope.onConfigLoad(instance);
            }
          });

          instance.on('dialogShow', function(ev) {
            // Take the dialog name and its definition from the event data.
            var dialogName = ev.data.definition.dialog.getName();
            var dialogDefinition = ev.data.definition;

            // Check if the definition is from the dialog window you are interested in (the "Link" dialog window).
            if (dialogName === 'base64imageDialog') {
              var dialog = dialogDefinition.dialog;

              // Disable unused elements
              dialog.getContentElement('tab-source', 'urlcheckbox').getElement().hide();
              dialog.getContentElement('tab-source', 'url').getElement().hide();
              var fileCheckbox = dialog.getContentElement('tab-source', 'filecheckbox');

              fileCheckbox.disable();

              // Part of the CKEditor library no inspection on dom.element.
              //noinspection JSPotentiallyInvalidConstructorUsage
              var uploadLabel = new CKEDITOR.dom.element('div');
              uploadLabel.setHtml('Upload');
              uploadLabel.setStyle('margin-top', '5px');

              var deferTime = setInterval(function() { //Styles are overridden after this cycle.
                fileCheckbox.getElement().getFirst().setStyle('visibility', 'hidden');
                window.clearInterval(deferTime);
              }, 0);

              // Disable complex unneeded options on the advanced settings pane.
              dialog.getContentElement('tab-properties', 'align').getElement().hide();
              dialog.getContentElement('tab-properties', 'vmargin').getElement().hide();
              dialog.getContentElement('tab-properties', 'hmargin').getElement().hide();
              dialog.getContentElement('tab-properties', 'border').getElement().hide();
            }
          });

          ngModel.$render = function() {
            data.push(ngModel.$viewValue);
            if (isReady) {
              onUpdateModelData();
            }
          };
        };

        try {
          if (CKEDITOR.status === 'loaded') {
            loaded = true;
          }
        } catch (e) {}
        if (loaded) {
          onLoad();
        } else {
          $defer.promise.then(onLoad);
        }
      }
    };
  }]);

  return app;
}));
