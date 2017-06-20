'use strict'

const hashCRC32 = require('./lib/hashes/CRC32.js').hashCRC32
const hashDJB2 = require('./lib/hashes/DJB2.js').hashDJB2
const hashFNV1A = require('./lib/hashes/FNV1a.js').hashFNV1
const hashSimple = require('./lib/hashes/Simple.js').hashSimple
const command_arguments = require('minimist')(process.argv.slice(2))

console.dir(command_arguments)

const targetSizeInKb = command_arguments['target-size-kb'] || 100
const inputPasswordFile = command_arguments['passwords-file']

let bloomFilterArray = new Uint8Array(targetSizeInKb * 1024)
let bloomFilterBitLength = bloomFilterArray.length * 8
var passwordCount = 0;

console.log(`Building ${targetSizeInKb} kb large judy array containing all passwords from ${inputPasswordFile}`)

function bloomFilterGetBit(array, index) {
  index = index >>> 0
  let byte = array[index / 8]
  return (byte & (1 << index % 8)) != 0
}

function bloomFilterSetBit(array, index) {
  index = index >>> 0
  let byte = array[Math.floor(index / 8)];
  byte = byte | (1 << (index % 8))
  array[Math.floor(index / 8)] = byte
}

function bloomFilterAddString(array, str) {
  let sizeInBits = array.length * 8
  let hash1 = Math.floor((hashCRC32(str)) % sizeInBits)
  let hash2 = Math.floor((hashFNV1A(str)) % sizeInBits)
  let hash3 = Math.floor((hashDJB2(str)) % sizeInBits)
  let hash4 = Math.floor((hashSimple(str)) % sizeInBits)

  // hashes reperesent bit indexes into array
  bloomFilterSetBit(array, hash1)
  bloomFilterSetBit(array, hash2)
  bloomFilterSetBit(array, hash3)
  bloomFilterSetBit(array, hash4)
}

function bloomFilterContainsString(array, str) {
  let sizeInBits = array.length * 8
  let hash1 = Math.floor((hashCRC32(str)) % sizeInBits)
  let hash2 = Math.floor((hashFNV1A(str)) % sizeInBits)
  let hash3 = Math.floor((hashDJB2(str)) % sizeInBits)
  let hash4 = Math.floor((hashSimple(str)) % sizeInBits)

  return bloomFilterGetBit(array, hash1) &&
         bloomFilterGetBit(array, hash2) &&
         bloomFilterGetBit(array, hash3) &&
         bloomFilterGetBit(array, hash4)
}

// Read the file
let lineReader = require('readline').createInterface({
  input: require('fs').createReadStream(inputPasswordFile)
})

function countBitsInByte(byte) {
    return (byte.toString(2).match(/1/g) || []).length;
}

lineReader.on('close', function (line) {
  var bitsSet = bloomFilterArray.reduce((memo, byte) => memo + countBitsInByte(byte), 0)
  
  console.log("Array built, occupancy is: " + bitsSet + " / " + bloomFilterBitLength + " (" + (100 * bitsSet / bloomFilterBitLength).toFixed(3) + " %)")
  
  var outPath = 'bloom/' + passwordCount + '.bloom.bin'
  var out = require('fs').createWriteStream(outPath)  
  out.write(Buffer.from(bloomFilterArray));
  out.close();
  console.log("Saved to " + outPath)
})

lineReader.on('line', function (line) {
  passwordCount ++;
  bloomFilterAddString(bloomFilterArray, line)
})
