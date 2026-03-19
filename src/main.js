var config = require('./config.js');
var CryptoJS = require("crypto-js");

function supportLanguages() {
  return config.supportedLanguages.map(([standardLang]) => standardLang);
}

function tts(query, completion) {
  const text = query.text;
  const secretKey = $option['apiKey'];
  const cacheDataNum = $option['cacheDataNum'];
  const voice = $option['voice'] || 'mimo_default';
  const audioKey = CryptoJS.MD5(voice + text).toString();
  const audioPath = '$sandbox/' + audioKey;

  // 检查缓存
  if ($file.exists(audioPath)) {
    var audioData = $file.read(audioPath).toUTF8();
    completion({
      result: {
        type: "base64",
        value: audioData,
        raw: {}
      }
    });
    return;
  }

  // 调用 MiMo-2 TTS API
  $http.request({
    method: "POST",
    url: "https://api.xiaomimimo.com/v1/chat/completions",
    header: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + secretKey
    },
    body: {
      model: "mimo-v2-tts",
      messages: [
        {
          role: "user",
          content: text
        }
      ],
      audio: {
        format: "wav",
        voice: voice
      }
    }
  }).then(function (resp) {
    var respBody = resp.data;
    if (typeof respBody === 'string') {
      respBody = JSON.parse(respBody);
    }
    var audioData = respBody.choices[0].message.audio.data;
    handleCache(audioKey, audioData, audioPath, cacheDataNum);
    completion({
      result: {
        type: "base64",
        value: audioData,
        raw: {}
      }
    });
  }).catch(function (err) {
    $log.error(err);
    completion({
      error: {
        type: err._type || 'unknown',
        message: err._message || '未知错误',
        addition: {}
      }
    });
  });
}

function handleCache(audioKey, audioData, audioPath, cacheDataNum) {
  var audioDataSaveSucc = $file.write({
    data: $data.fromUTF8(audioData),
    path: audioPath
  });

  if (!audioDataSaveSucc) return;

  var cachesPath = '$sandbox/caches.list';
  var cachesList = audioKey;

  if ($file.exists(cachesPath)) {
    var data = $file.read(cachesPath);
    var cacheData = data.toUTF8().split("\n");

    if (cacheData.length >= cacheDataNum) {
      var delAudioKey = cacheData.shift();
      $file.delete('$sandbox/' + delAudioKey);
    }

    cacheData.push(audioKey);
    cachesList = cacheData.join("\n");
  }

  $file.write({
    data: $data.fromUTF8(cachesList),
    path: cachesPath
  });
}

exports.supportLanguages = supportLanguages;
exports.tts = tts;
