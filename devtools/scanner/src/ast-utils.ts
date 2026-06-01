import * as ts from "typescript"

export function dumpTree(tree: ts.SourceFile) {
	let indent = 0
	const dumpInternal = (node: ts.Node) => {
		if (node.getChildCount(tree) == 0)
		{
			//leaf
			console.log(new Array(indent + 1).join(" ") + ts.SyntaxKind[node.kind], `"${node.getText(tree)}"`)
		} else {
			console.log(new Array(indent + 1).join(" ") + ts.SyntaxKind[node.kind])
		}
		
		indent++
		ts.forEachChild(node, dumpInternal)
		indent--
	}

	dumpInternal(tree)
}

export function iterateUsingStatements(tree: ts.SourceFile) { //, cb: (varName: string, funcName: string) => any) {
	tree.forEachChild((node) => {
		if (node.kind != ts.SyntaxKind.FirstStatement) return

		node.forEachChild((varDeclList) => {
			if (varDeclList.kind != ts.SyntaxKind.VariableDeclarationList) return

			varDeclList.forEachChild((varDecl) => {
				if (varDecl.kind != ts.SyntaxKind.VariableDeclaration) return

                

                const [ident, op, value] = varDecl.getChildren(tree)

                //console.log(ts.SyntaxKind[ident.kind], ts.SyntaxKind[op.kind], ts.SyntaxKind[value.kind])

                 if (ident.kind != ts.SyntaxKind.Identifier) return
                 if (value.kind != ts.SyntaxKind.CallExpression) return

                console.log("VAR DECL:")
				console.log("    ", ident.getText(tree), ts.SyntaxKind[ident.kind])
				// console.log("    ", op.getText(tree), ts.SyntaxKind[op.kind])
				//console.log("    ", value.getText(tree), ts.SyntaxKind[value.kind])

				const callChildren = value.getChildren(tree);

				console.log("    ", callChildren[0].getText(tree))
				for (let i = 1; i < callChildren.length; ++i) {
					console.log("        ", callChildren[i].getText(tree), ts.SyntaxKind[callChildren[i].kind])
				}
			})
		})
	})
}
