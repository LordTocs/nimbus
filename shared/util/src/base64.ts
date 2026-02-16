//https://stackoverflow.com/questions/6213227/fastest-way-to-convert-a-number-to-radix-64-in-javascript

//   0       8       16      24      32      40      48      56     63
//   v       v       v       v       v       v       v       v      v
const rixits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/"
// You have the freedom, here, to choose the glyphs you want for
// representing your base-64 numbers. The ASCII encoding guys usually
// choose a set of glyphs beginning with ABCD..., but, looking at
// your update #2, I deduce that you want glyphs beginning with
// 0123..., which is a fine choice and aligns the first ten numbers
// in base 64 with the first ten numbers in decimal.

export const base64 = {
	// This cannot handle negative numbers and only works on the
	//     integer part, discarding the fractional part.
	// Doing better means deciding on whether you're just representing
	// the subset of javascript numbers of twos-complement 32-bit integers
	// or going with base-64 representations for the bit pattern of the
	// underlying IEEE floating-point number, or representing the mantissae
	// and exponents separately, or some other possibility. For now, bail
	fromNumber(num: number) {
		if (isNaN(Number(num)) || num === null || num === Number.POSITIVE_INFINITY) throw "The input is not valid"
		if (num < 0) throw "Can't represent negative numbers now"

		let rixit // like 'digit', only in some non-decimal radix
		let residual = Math.floor(num)
		let result = ""
		while (true) {
			rixit = residual % 64
			// console.log("rixit : " + rixit);
			// console.log("result before : " + result);
			result = rixits.charAt(rixit) + result
			// console.log("result after : " + result);
			// console.log("residual before : " + residual);
			residual = Math.floor(residual / 64)
			// console.log("residual after : " + residual);

			if (residual == 0) break
		}
		return result
	},

	toNumber(encoded: string) {
		let result = 0
		// console.log("rixits : " + rixits);
		// console.log("rixits.split('') : " + rixits.split(''));
		const rixitsArr = encoded.split("")
		for (let e = 0; e < rixitsArr.length; e++) {
			// console.log("_Rixits.indexOf(" + rixits[e] + ") : " +
			// this._Rixits.indexOf(rixits[e]));
			// console.log("result before : " + result);
			result = result * 64 + rixits.indexOf(rixits[e])
			// console.log("result after : " + result);
		}
		return result
	},
}
