/// <reference path="types.d.ts" />
/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Результат проверки: true либо false и строка причины отдельными значениями Lua. */
  type CryptoVerification=LuaMultiReturn<[true]|[false,string]>;
  /** Расшифрованная бинарная строка либо undefined и причина ошибки. */
  type CryptoDecryption=LuaMultiReturn<[string]|[undefined,string]>;
  /** Состояние поэтапного вычисления хеша. */
  interface HashContext {
    /** Добавляет бинарную строку к хешируемым данным и возвращает контекст. */
    update(this:HashContext,bytes:string):HashContext;
    /** Завершает вычисление и возвращает хеш как бинарную строку. */
    final(this:HashContext):string;
    /** Сбрасывает состояние хеширования и возвращает контекст. */
    reset(this:HashContext):HashContext;
  }
}
/** Хеширование, подписи, обмен ключами и шифрование бинарных строк. */
declare namespace crypto {
  /** Версия криптографического API движка. */
  const API_VERSION:number;
  /** Вычисляет SHA256 бинарной строки и возвращает хеш в бинарном виде. */
  function sha256(this:void,bytes:string):string;
  /** Вычисляет SHA384 бинарной строки и возвращает хеш в бинарном виде. */
  function sha384(this:void,bytes:string):string;
  /** Вычисляет SHA512 бинарной строки и возвращает хеш в бинарном виде. */
  function sha512(this:void,bytes:string):string;
  /** Вычисляет MD5 бинарной строки и возвращает хеш в бинарном виде. */
  function md5(this:void,bytes:string):string;
  /** Вычисляет хеш бинарной строки указанным алгоритмом. */
  function hash(this:void,algorithm:string,bytes:string):string;
  /** Создаёт контекст поэтапного хеширования выбранным алгоритмом. */
  function hash_new(this:void,algorithm:string):VC.HashContext;
  /** Вычисляет HMAC сообщения с ключом и указанным алгоритмом хеширования. */
  function hmac(this:void,algorithm:string,key:string,message:string):string;
  /** Создаёт закрытый и открытый ключи ED25519 отдельными бинарными строками Lua. */
  function ed25519_keypair(this:void):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  /** Получает открытый ключ ED25519 из закрытого ключа. */
  function ed25519_public(this:void,privateKey:string):string;
  /** Создаёт закрытый и открытый ключи X25519 отдельными бинарными строками Lua. */
  function x25519_keypair(this:void):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  /** Получает открытый ключ X25519 из закрытого ключа. */
  function x25519_public(this:void,privateKey:string):string;
  /** Создаёт закрытый и открытый ключи P256 отдельными бинарными строками Lua. */
  function p256_keypair(this:void):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  /** Получает открытый ключ P256 из закрытого ключа. */
  function p256_public(this:void,privateKey:string):string;
  /** Подписывает сообщение закрытым ключом Ed25519 и возвращает бинарную подпись. */
  function ed25519_sign(this:void,privateKey:string,message:string):string;
  /** Проверяет подпись Ed25519 и возвращает результат с причиной неудачи. */
  function ed25519_verify(this:void,publicKey:string,message:string,signature:string):VC.CryptoVerification;
  /** Создаёт закрытый и открытый ключи ECDSA для указанной кривой. */
  function ecdsa_keypair(this:void,curve:string):LuaMultiReturn<[privateKey:string,publicKey:string]>;
  /** Получает открытый ключ ECDSA из закрытого ключа выбранной кривой. */
  function ecdsa_public(this:void,curve:string,privateKey:string):string;
  /** Подписывает сообщение ключом ECDSA с выбранными кривой и хешем. */
  function ecdsa_sign(this:void,curve:string,privateKey:string,message:string,hash:string):string;
  /** Проверяет подпись ECDSA с выбранными кривой и хешем. */
  function ecdsa_verify(this:void,curve:string,publicKey:string,message:string,signature:string,hash:string):VC.CryptoVerification;
  /** Проверяет подпись RSA PKCS#1 по модулю, экспоненте и алгоритму хеша. */
  function rsa_pkcs1_verify(this:void,hash:string,modulus:string,exponent:string,message:string,signature:string):VC.CryptoVerification;
  /** Проверяет подпись RSA-PSS с указанными хешем и длиной соли. */
  function rsa_pss_verify(this:void,hash:string,modulus:string,exponent:string,message:string,signature:string,saltLength:number):VC.CryptoVerification;
  /** Вычисляет общий секрет X25519 из своего закрытого и чужого открытого ключа. */
  function x25519(this:void,privateKey:string,publicKey:string):string;
  /** Вычисляет общий секрет X25519 из своего закрытого и чужого открытого ключа. */
  function x25519_shared(this:void,privateKey:string,publicKey:string):string;
  /** Вычисляет общий секрет P-256 из своего закрытого и чужого открытого ключа. */
  function p256_shared(this:void,privateKey:string,publicKey:string):string;
  /** Шифрует plaintext алгоритмом AES_GCM с ключом, nonce и дополнительными данными aad. */
  function aes_gcm_encrypt(this:void,key:string,nonce:string,aad:string,plaintext:string):string;
  /** Расшифровывает и проверяет данные AES_GCM; при неудаче возвращает undefined и причину. */
  function aes_gcm_decrypt(this:void,key:string,nonce:string,aad:string,ciphertext:string):VC.CryptoDecryption;
  /** Шифрует plaintext алгоритмом CHACHA20_POLY1305 с ключом, nonce и дополнительными данными aad. */
  function chacha20_poly1305_encrypt(this:void,key:string,nonce:string,aad:string,plaintext:string):string;
  /** Расшифровывает и проверяет данные CHACHA20_POLY1305; при неудаче возвращает undefined и причину. */
  function chacha20_poly1305_decrypt(this:void,key:string,nonce:string,aad:string,ciphertext:string):VC.CryptoDecryption;
  /** Возвращает криптографически случайную бинарную строку заданной длины. */
  function random_bytes(this:void,length:number):string;
  /** Сравнивает бинарные строки с защитой от утечки через время сравнения. */
  function constant_time_equal(this:void,a:string,b:string):boolean;
  /** Получает промежуточный ключ HKDF из исходного материала ikm и соли. */
  function hkdf_extract(this:void,hash:string,salt:string,ikm:string):string;
  /** Расширяет промежуточный ключ HKDF до заданной длины с контекстом info. */
  function hkdf_expand(this:void,hash:string,prk:string,info:string,length:number):string;
  /** Выводит ключ из пароля с солью, числом итераций и выбранным хешем. */
  function pbkdf2(this:void,hash:string,password:string,salt:string,iterations:number,length:number):string;
  /** Выводит ключ из пароля с параметрами затрат n, r, p и ограничением памяти. */
  function scrypt(this:void,password:string,salt:string,n:number,r:number,p:number,length:number,maxMemory?:number):string;
  /** Возвращает сведения о криптографической библиотеке и поддерживаемых возможностях. */
  function features(this:void):{
    /** Имя криптографической библиотеки движка. */
    backend:string;
    /** Версия криптографической библиотеки. */
    backend_version:string;
    /** Версия поддерживаемого криптографического API. */
    api_version:number
  } & Record<string,boolean|string|number>;
}
