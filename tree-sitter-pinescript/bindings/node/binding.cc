#include "tree_sitter/parser.h"
#include <node.h>
#include "nan.h"

using namespace v8;

extern "C" TSLanguage * tree_sitter_pinescript();

namespace {

NAN_METHOD(New) {
  Nan::HandleScope scope;
  return;
}

NAN_METHOD(Language) {
  Nan::HandleScope scope;
  Local<Object> instance = Nan::New<Object>();
  Nan::Set(instance, Nan::New("name").ToLocalChecked(), Nan::New("pinescript").ToLocalChecked());
  Nan::Set(instance, Nan::New("language").ToLocalChecked(), Nan::New<External>(tree_sitter_pinescript()));
  info.GetReturnValue().Set(instance);
}

NAN_MODULE_INIT(Init) {
  Nan::Set(target, Nan::New("name").ToLocalChecked(), Nan::New("pinescript").ToLocalChecked());
  Nan::Set(target, Nan::New("language").ToLocalChecked(), Nan::New<External>(tree_sitter_pinescript()));
}

NODE_MODULE(tree_sitter_pinescript_binding, Init)

}  // namespace
