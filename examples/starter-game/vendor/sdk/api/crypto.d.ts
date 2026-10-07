/// <reference path="types.d.ts" />
/** Raw binary Lua strings, not Bytearray or hexadecimal. Runtime must support crypto.API_VERSION. */
declare namespace VC {
  type CryptoVerification=LuaMultiReturn<[true]|[false,string]>;
  type CryptoDecryption=LuaMultiReturn<[string]|[undefined,string]>;
  interface HashContext {
    update(this:HashContext,bytes:string):HashContext;
    final(this:HashContext):string;
    reset(this:HashContext):HashContext;
  }
}
declare namespace crypto {
  const API_VERSION:number;
  function sha256(this:void,bytes:string):string;
  function sha384(this:void,bytes:string):string;
  function sha512(this:void,bytes:string):string;
  function md5(this:void,bytes:string):string;
  function hash(this:void,algorithm:string,bytes:string):string;
  function hash_new(this:void,algorithm:string):VC.HashContext;
  function hmac(this:void,algorithm:string,key:string,message:string):string;
  function ed25519_keypair(this:void):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  function ed25519_public(this:void,privateKey:string):string;
  function x25519_keypair(this:void):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  function x25519_public(this:void,privateKey:string):string;
  function p256_keypair(this:void):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  function p256_public(this:void,privateKey:string):string;
  function ed25519_sign(this:void,privateKey:string,message:string):string;
  function ed25519_verify(this:void,publicKey:string,message:string,signature:string):VC.CryptoVerification;
  function ecdsa_keypair(this:void,curve:string):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  function ecdsa_public(this:void,curve:string,privateKey:string):string;
  function ecdsa_sign(this:void,curve:string,privateKey:string,message:string,hash:string):string;
  function ecdsa_verify(this:void,curve:string,publicKey:string,message:string,signature:string,hash:string):VC.CryptoVerification;
  function rsa_pkcs1_verify(this:void,hash:string,modulus:string,exponent:string,message:string,signature:string):VC.CryptoVerification;
  function rsa_pss_verify(this:void,hash:string,modulus:string,exponent:string,message:string,signature:string,saltLength:number):VC.CryptoVerification;
  function x25519(this:void,privateKey:string,publicKey:string):string;
  function x25519_shared(this:void,privateKey:string,publicKey:string):string;
  function p256_shared(this:void,privateKey:string,publicKey:string):string;
  function aes_gcm_encrypt(this:void,key:string,nonce:string,aad:string,plaintext:string):string;
  function aes_gcm_decrypt(this:void,key:string,nonce:string,aad:string,ciphertext:string):VC.CryptoDecryption;
  function chacha20_poly1305_encrypt(this:void,key:string,nonce:string,aad:string,plaintext:string):string;
  function chacha20_poly1305_decrypt(this:void,key:string,nonce:string,aad:string,ciphertext:string):VC.CryptoDecryption;
  function random_bytes(this:void,length:number):string;
  function constant_time_equal(this:void,a:string,b:string):boolean;
  function hkdf_extract(this:void,hash:string,salt:string,ikm:string):string;
  function hkdf_expand(this:void,hash:string,prk:string,info:string,length:number):string;
  function pbkdf2(this:void,hash:string,password:string,salt:string,iterations:number,length:number):string;
  function scrypt(this:void,password:string,salt:string,n:number,r:number,p:number,length:number,maxMemory?:number):string;
  function features(this:void):{backend:string;backend_version:string;api_version:number} & Record<string,boolean|string|number>;
}
